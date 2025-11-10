import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyServiceRecord {
  id: string;
  titulo: string;
  descricao: string;
  solucao?: string;
  status: string;
  data_atendimento: string;
  hora_inicio: string;
  hora_fim?: string;
  canal: 'whatsapp' | 'ligacao' | 'visita_tecnica';
  observacoes?: string;
  fotos?: any[];
  companies: { nome_fantasia: string };
  profiles: { nome: string };
  tickets?: { numero: number; titulo: string } | null;
  assets?: { tag_patrimonial: string; tipo: string } | null;
}

export const exportSingleDailyServiceToPDF = async (record: DailyServiceRecord) => {
  const doc = new jsPDF();
  let currentY = 20;

  // ========== CABEÇALHO ==========
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Atendimento', 14, currentY);
  currentY += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    14,
    currentY
  );
  currentY += 12;

  // ========== INFORMAÇÕES PRINCIPAIS ==========
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(record.titulo, 14, currentY);
  currentY += 8;

  // Grid de informações
  const canalLabel = {
    whatsapp: 'WhatsApp',
    ligacao: 'Ligação',
    visita_tecnica: 'Visita Técnica'
  }[record.canal];

  const statusLabel = {
    concluido: 'Concluído',
    em_andamento: 'Em Andamento',
    pendente: 'Pendente'
  }[record.status] || record.status;

  const infoRows: [string, string][] = [
    ['Empresa', record.companies.nome_fantasia],
    ['Técnico', record.profiles.nome],
    ['Data', format(new Date(record.data_atendimento), 'dd/MM/yyyy', { locale: ptBR })],
    ['Horário Início', record.hora_inicio],
    ['Horário Fim', record.hora_fim || '-'],
    ['Canal', canalLabel],
    ['Status', statusLabel],
  ];

  if (record.tickets) {
    infoRows.push(['Chamado Vinculado', `#${record.tickets.numero} - ${record.tickets.titulo}`]);
  }

  if (record.assets) {
    infoRows.push(['Ativo Vinculado', `${record.assets.tag_patrimonial} - ${record.assets.tipo}`]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Campo', 'Valor']],
    body: infoRows,
    styles: { fontSize: 10 },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 130 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ========== DESCRIÇÃO ==========
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Descrição do Atendimento', 14, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(record.descricao, 180);
  doc.text(descLines, 14, currentY);
  currentY += (descLines.length * 5) + 8;

  // ========== SOLUÇÃO ==========
  if (record.solucao) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Solução Aplicada', 14, currentY);
    currentY += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const solLines = doc.splitTextToSize(record.solucao, 180);
    doc.text(solLines, 14, currentY);
    currentY += (solLines.length * 5) + 8;
  }

  // ========== OBSERVAÇÕES ==========
  if (record.observacoes) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', 14, currentY);
    currentY += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(record.observacoes, 180);
    doc.text(obsLines, 14, currentY);
    currentY += (obsLines.length * 5) + 8;
  }

  // ========== FOTOS ==========
  if (record.fotos && record.fotos.length > 0) {
    if (currentY > 200) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fotos (${record.fotos.length})`, 14, currentY);
    currentY += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('As fotos estão armazenadas digitalmente e podem ser acessadas pelo sistema.', 14, currentY);
    currentY += 6;

    // Lista de URLs das fotos
    record.fotos.forEach((foto: any, index: number) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${index + 1}. ${foto.name || `Foto ${index + 1}`}`, 20, currentY);
      currentY += 4;
    });
  }

  // ========== RODAPÉ ==========
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // ========== SALVAR ==========
  const fileName = `atendimento_${record.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};
