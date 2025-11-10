import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyServiceStats {
  total: number;
  whatsapp: number;
  ligacao: number;
  visita_tecnica: number;
  concluidos: number;
  em_andamento: number;
  pendentes: number;
  tempo_medio: number;
}

export const exportDailyServicesToPDF = (
  records: any[], 
  stats: DailyServiceStats
) => {
  const doc = new jsPDF('landscape');
  let currentY = 20;

  // ============= CABEÇALHO =============
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Atendimentos Diários', 14, currentY);
  currentY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    14,
    currentY
  );
  currentY += 6;

  // ============= ESTATÍSTICAS RESUMIDAS =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', 14, currentY);
  currentY += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Linha 1 de estatísticas
  doc.text(`Total de Atendimentos: ${stats.total}`, 14, currentY);
  doc.text(`Concluídos: ${stats.concluidos}`, 80, currentY);
  doc.text(`Em Andamento: ${stats.em_andamento}`, 140, currentY);
  doc.text(`Pendentes: ${stats.pendentes}`, 200, currentY);
  currentY += 6;

  // Linha 2 de estatísticas (canais)
  doc.text(`WhatsApp: ${stats.whatsapp}`, 14, currentY);
  doc.text(`Ligações: ${stats.ligacao}`, 80, currentY);
  doc.text(`Visitas Técnicas: ${stats.visita_tecnica}`, 140, currentY);
  doc.text(
    `Tempo Médio: ${Math.floor(stats.tempo_medio / 60)}h ${stats.tempo_medio % 60}m`,
    200,
    currentY
  );
  currentY += 10;

  // ============= TABELA DE ATENDIMENTOS =============
  const tableData = records.map(record => {
    const dataFormatada = format(
      new Date(record.data_atendimento), 
      'dd/MM/yyyy', 
      { locale: ptBR }
    );
    
    const canalLabel = {
      whatsapp: 'WhatsApp',
      ligacao: 'Ligação',
      visita_tecnica: 'Visita'
    }[record.canal] || record.canal;

    const statusLabel = {
      concluido: 'Concluído',
      em_andamento: 'Em Andamento',
      pendente: 'Pendente'
    }[record.status] || record.status;

    const horario = record.hora_fim 
      ? `${record.hora_inicio} - ${record.hora_fim}`
      : record.hora_inicio;

    return [
      dataFormatada,
      canalLabel,
      record.titulo || '-',
      record.companies?.nome_fantasia || '-',
      record.profiles?.nome || '-',
      statusLabel,
      horario || '-'
    ];
  });

  autoTable(doc, {
    head: [[
      'Data',
      'Canal',
      'Título',
      'Empresa',
      'Técnico',
      'Status',
      'Horário'
    ]],
    body: tableData,
    startY: currentY,
    styles: { 
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      halign: 'left'
    },
    headStyles: {
      fillColor: [59, 130, 246], // Azul primário
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245] // Cinza claro
    },
    columnStyles: {
      0: { cellWidth: 25 },  // Data
      1: { cellWidth: 25 },  // Canal
      2: { cellWidth: 60 },  // Título
      3: { cellWidth: 50 },  // Empresa
      4: { cellWidth: 40 },  // Técnico
      5: { cellWidth: 30 },  // Status
      6: { cellWidth: 30 }   // Horário
    },
    margin: { top: 40, left: 14, right: 14 },
    didDrawPage: (data) => {
      // Rodapé com numeração de páginas
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
  });

  // ============= SALVAR PDF =============
  const dataAtual = format(new Date(), 'yyyy-MM-dd');
  doc.save(`atendimentos-diarios_${dataAtual}.pdf`);
};
