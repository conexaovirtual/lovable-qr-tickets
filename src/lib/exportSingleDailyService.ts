import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { imageUrlToBase64 } from '@/lib/imageUtils';
import { formatDateBR } from '@/lib/formatters';

// Função auxiliar para carregar logo local
const getConexaoVirtualLogo = async (): Promise<string | null> => {
  try {
    const response = await fetch('/logo-conexaovirtual.png');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao carregar logo da Conexão Virtual:', error);
    return null;
  }
};

// Calcular duração entre dois horários
const calcularDuracao = (inicio: string, fim?: string): string => {
  if (!fim) return '-';
  try {
    const [hi, mi] = inicio.split(':').map(Number);
    const [hf, mf] = fim.split(':').map(Number);
    let diffMin = (hf * 60 + mf) - (hi * 60 + mi);
    if (diffMin < 0) diffMin += 24 * 60;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hours === 0) return `${mins}min`;
    return `${hours}h${mins > 0 ? `${mins.toString().padStart(2, '0')}min` : ''}`;
  } catch {
    return '-';
  }
};

// Formatar coordenadas GPS
const formatGPS = (lat?: number | null, lng?: number | null): string => {
  if (!lat || !lng) return '';
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

interface DailyServiceRecord {
  id: string;
  titulo: string;
  descricao: string;
  solucao?: string;
  status: string;
  data_atendimento: string;
  hora_inicio: string;
  hora_fim?: string;
  canal: 'whatsapp' | 'ligacao' | 'visita_tecnica' | 'acesso_remoto';
  observacoes?: string;
  fotos?: any[];
  endereco_cliente?: string;
  latitude_inicio?: number | null;
  longitude_inicio?: number | null;
  latitude_fim?: number | null;
  longitude_fim?: number | null;
  companies: { nome_fantasia: string; cnpj?: string; endereco?: string; telefone?: string; email?: string };
  profiles: { nome: string; telefone?: string };
  tickets?: { numero: number; titulo: string } | null;
  assets?: { tag_patrimonial?: string; tipo: string; nome: string; fabricante?: string; modelo?: string; numero_serie?: string } | null;
}

export const exportSingleDailyServiceToPDF = async (record: DailyServiceRecord) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.height;
  let currentY = 20;

  const checkPageBreak = (needed: number) => {
    if (currentY + needed > pageHeight - 25) {
      doc.addPage();
      currentY = 20;
    }
  };

  // ========== LOGO ==========
  const logoBase64 = await getConexaoVirtualLogo();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', pageWidth - 60, 10, 50, 19);
    } catch (error) {
      console.error('Erro ao adicionar logo:', error);
    }
  }

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
  currentY += 4;

  // ID do atendimento
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`ID: ${record.id}`, 14, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 10;

  // ========== TÍTULO ==========
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(record.titulo, pageWidth - 28);
  doc.text(titleLines, 14, currentY);
  currentY += (titleLines.length * 6) + 6;

  // ========== INFORMAÇÕES DO ATENDIMENTO ==========
  const canalLabel: Record<string, string> = {
    whatsapp: 'WhatsApp',
    ligacao: 'Ligação',
    visita_tecnica: 'Visita Técnica',
    acesso_remoto: 'Acesso Remoto',
  };

  const statusLabel: Record<string, string> = {
    concluido: '✅ Concluído',
    em_andamento: '🔄 Em Andamento',
    pendente: '⏳ Pendente',
  };

  const duracao = calcularDuracao(record.hora_inicio, record.hora_fim);

  const infoRows: [string, string][] = [
    ['📅 Data', formatDateBR(record.data_atendimento)],
    ['⏰ Horário', `${record.hora_inicio} até ${record.hora_fim || 'em andamento'}`],
    ['⏱️ Duração', duracao],
    ['📡 Canal', canalLabel[record.canal] || record.canal],
    ['📊 Status', statusLabel[record.status] || record.status],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Dados do Atendimento', '']],
    body: infoRows,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  });
  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ========== DADOS DA EMPRESA ==========
  checkPageBreak(40);
  const companyRows: [string, string][] = [
    ['🏢 Empresa', record.companies.nome_fantasia],
  ];
  if (record.companies.cnpj) companyRows.push(['📄 CNPJ', record.companies.cnpj]);
  if (record.companies.telefone) companyRows.push(['📞 Telefone', record.companies.telefone]);
  if (record.companies.email) companyRows.push(['📧 Email', record.companies.email]);
  if (record.endereco_cliente) {
    companyRows.push(['📍 Endereço do Atendimento', record.endereco_cliente]);
  } else if (record.companies.endereco) {
    companyRows.push(['📍 Endereço', record.companies.endereco]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Dados do Cliente', '']],
    body: companyRows,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  });
  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ========== DADOS DO TÉCNICO ==========
  checkPageBreak(30);
  const techRows: [string, string][] = [
    ['👤 Técnico', record.profiles.nome],
  ];
  if (record.profiles.telefone) techRows.push(['📞 Contato', record.profiles.telefone]);

  // GPS do técnico
  const gpsInicio = formatGPS(record.latitude_inicio, record.longitude_inicio);
  const gpsFim = formatGPS(record.latitude_fim, record.longitude_fim);
  if (gpsInicio) techRows.push(['📍 GPS Check-in', gpsInicio]);
  if (gpsFim) techRows.push(['📍 GPS Check-out', gpsFim]);

  autoTable(doc, {
    startY: currentY,
    head: [['Dados do Técnico', '']],
    body: techRows,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: {
      fillColor: [139, 92, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  });
  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ========== ATIVO VINCULADO ==========
  if (record.assets) {
    checkPageBreak(30);
    const assetRows: [string, string][] = [
      ['💻 Nome', record.assets.nome || '-'],
      ['📦 Tipo', record.assets.tipo],
    ];
    if (record.assets.fabricante) assetRows.push(['🏭 Fabricante', record.assets.fabricante]);
    if (record.assets.modelo) assetRows.push(['📋 Modelo', record.assets.modelo]);
    if (record.assets.numero_serie) assetRows.push(['🔢 Nº Série', record.assets.numero_serie]);
    if (record.assets.tag_patrimonial) assetRows.push(['🏷️ Patrimônio', record.assets.tag_patrimonial]);

    autoTable(doc, {
      startY: currentY,
      head: [['Ativo Vinculado', '']],
      body: assetRows,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ========== CHAMADO VINCULADO ==========
  if (record.tickets) {
    checkPageBreak(20);
    autoTable(doc, {
      startY: currentY,
      head: [['Chamado Vinculado', '']],
      body: [['🎫 Chamado', `#${record.tickets.numero} - ${record.tickets.titulo}`]],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ========== DESCRIÇÃO ==========
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('📝 Descrição do Atendimento', 14, currentY);
  doc.setTextColor(0, 0, 0);
  currentY += 6;

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(record.descricao, pageWidth - 28);
  for (const line of descLines) {
    checkPageBreak(6);
    doc.text(line, 14, currentY);
    currentY += 5;
  }
  currentY += 5;

  // ========== SOLUÇÃO ==========
  if (record.solucao) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('✅ Solução Aplicada', 14, currentY);
    doc.setTextColor(0, 0, 0);
    currentY += 6;

    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const solLines = doc.splitTextToSize(record.solucao, pageWidth - 28);
    for (const line of solLines) {
      checkPageBreak(6);
      doc.text(line, 14, currentY);
      currentY += 5;
    }
    currentY += 5;
  }

  // ========== OBSERVAÇÕES ==========
  if (record.observacoes) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11);
    doc.text('📌 Observações', 14, currentY);
    doc.setTextColor(0, 0, 0);
    currentY += 6;

    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(record.observacoes, pageWidth - 28);
    for (const line of obsLines) {
      checkPageBreak(6);
      doc.text(line, 14, currentY);
      currentY += 5;
    }
    currentY += 5;
  }

  // ========== FOTOS ==========
  if (record.fotos && record.fotos.length > 0) {
    checkPageBreak(80);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(139, 92, 246);
    doc.text(`📸 Fotos do Atendimento (${record.fotos.length})`, 14, currentY);
    doc.setTextColor(0, 0, 0);
    currentY += 10;

    const photoWidth = 80;
    const photoHeight = 60;
    const margin = 10;
    const startX = 20;
    let currentX = startX;
    let photoY = currentY;
    let photosInRow = 0;

    for (let i = 0; i < record.fotos.length; i++) {
      const foto = record.fotos[i];
      
      try {
        const base64Image = await imageUrlToBase64(foto.url);
        
        if (photosInRow === 2) {
          currentX = startX;
          photoY += photoHeight + margin + 5;
          photosInRow = 0;
          
          if (photoY + photoHeight > pageHeight - 25) {
            doc.addPage();
            photoY = 20;
          }
        }
        
        doc.addImage(base64Image, 'JPEG', currentX, photoY, photoWidth, photoHeight);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const caption = foto.name || `Foto ${i + 1}`;
        doc.text(caption.substring(0, 30), currentX, photoY + photoHeight + 4);
        
        currentX += photoWidth + margin;
        photosInRow++;
        
      } catch (error) {
        console.error(`Erro ao adicionar foto ${i + 1}:`, error);
        
        doc.setFillColor(240, 240, 240);
        doc.rect(currentX, photoY, photoWidth, photoHeight, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('Erro ao carregar', currentX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
        
        currentX += photoWidth + margin;
        photosInRow++;
      }
    }
    
    currentY = photoY + photoHeight + 15;
  }

  // ========== RODAPÉ ==========
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Conexão Virtual – Relatório de Atendimento | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  }

  // ========== SALVAR ==========
  const companyName = record.companies.nome_fantasia.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const fileName = `atendimento_${companyName}_${format(new Date(record.data_atendimento), 'yyyy-MM-dd')}_${record.id.substring(0, 8)}.pdf`;
  doc.save(fileName);
};
