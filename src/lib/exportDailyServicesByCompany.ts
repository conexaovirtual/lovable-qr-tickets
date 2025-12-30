import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { imageUrlToBase64Cached } from './imageUtils';
import { formatDateBR } from './formatters';

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
    console.error('Erro ao carregar logo:', error);
    return null;
  }
};

interface CompanyDailyServiceRecord {
  id: string;
  titulo: string;
  descricao: string;
  solucao: string | null;
  data_atendimento: string;
  hora_inicio: string;
  hora_fim: string | null;
  canal: string;
  status: string;
  fotos: Array<{ url: string; name: string }> | null;
  profiles?: { nome: string };
}

interface CompanyStats {
  total: number;
  whatsapp: number;
  ligacao: number;
  visita_tecnica: number;
  acesso_remoto: number;
  concluidos: number;
  em_andamento: number;
  pendentes: number;
  tempo_medio: number;
}

export const exportDailyServicesByCompanyToPDF = async (
  companyName: string,
  records: CompanyDailyServiceRecord[],
  stats: CompanyStats,
  filters?: { dataInicio?: string; dataFim?: string }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 20;

  // ========== LOGO ==========
  const logoBase64 = await getConexaoVirtualLogo();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', pageWidth - 70, 10, 60, 23);
    } catch (error) {
      console.error('Erro ao adicionar logo:', error);
    }
  }

  // ============= CABEÇALHO =============
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Atendimentos', 14, currentY);
  currentY += 8;

  doc.setFontSize(14);
  doc.text(companyName, 14, currentY);
  currentY += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    14,
    currentY
  );
  currentY += 6;

  if (filters?.dataInicio || filters?.dataFim) {
    const periodoText = filters.dataInicio && filters.dataFim
      ? `Período: ${format(new Date(filters.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(filters.dataFim), 'dd/MM/yyyy', { locale: ptBR })}`
      : filters.dataInicio
      ? `A partir de: ${format(new Date(filters.dataInicio), 'dd/MM/yyyy', { locale: ptBR })}`
      : `Até: ${format(new Date(filters.dataFim), 'dd/MM/yyyy', { locale: ptBR })}`;
    
    doc.text(periodoText, 14, currentY);
    currentY += 6;
  }

  currentY += 4;

  // ============= RESUMO EXECUTIVO =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Executivo', 14, currentY);
  currentY += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const resumoData = [
    ['Total de Atendimentos', stats.total.toString()],
    ['Concluídos', stats.concluidos.toString()],
    ['Em Andamento', stats.em_andamento.toString()],
    ['Pendentes', stats.pendentes.toString()],
    ['Tempo Médio de Atendimento', `${Math.floor(stats.tempo_medio / 60)}h ${stats.tempo_medio % 60}m`],
    ['', ''],
    ['Atendimentos por Canal', ''],
    ['WhatsApp', stats.whatsapp.toString()],
    ['Ligações', stats.ligacao.toString()],
    ['Visitas Técnicas', stats.visita_tecnica.toString()],
    ['Acesso Remoto', stats.acesso_remoto.toString()],
  ];

  autoTable(doc, {
    body: resumoData,
    startY: currentY,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 40 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ============= DETALHES DOS ATENDIMENTOS =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Atendimentos Detalhados', 14, currentY);
  currentY += 8;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Verificar se precisa de nova página
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    // Cabeçalho do atendimento
    doc.setFillColor(59, 130, 246);
    doc.rect(14, currentY - 5, pageWidth - 28, 8, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`Atendimento #${i + 1} - ${record.titulo}`, 16, currentY);
    currentY += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Informações do atendimento
    const canalLabel = {
      whatsapp: 'WhatsApp',
      ligacao: 'Ligação',
      visita_tecnica: 'Visita Técnica',
      acesso_remoto: 'Acesso Remoto'
    }[record.canal] || record.canal;

    const statusLabel = {
      concluido: 'Concluído',
      em_andamento: 'Em Andamento',
      pendente: 'Pendente'
    }[record.status] || record.status;

    const infoData = [
      ['Data', formatDateBR(record.data_atendimento)],
      ['Horário', record.hora_fim ? `${record.hora_inicio} - ${record.hora_fim}` : record.hora_inicio],
      ['Técnico', record.profiles?.nome || '-'],
      ['Canal', canalLabel],
      ['Status', statusLabel],
    ];

    autoTable(doc, {
      body: infoData,
      startY: currentY,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: 60 }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // Descrição
    doc.setFont('helvetica', 'bold');
    doc.text('Descrição:', 14, currentY);
    currentY += 5;
    
    doc.setFont('helvetica', 'normal');
    const descricaoLines = doc.splitTextToSize(record.descricao || '-', pageWidth - 28);
    doc.text(descricaoLines, 14, currentY);
    currentY += descricaoLines.length * 5 + 2;

    // Solução
    if (record.solucao) {
      doc.setFont('helvetica', 'bold');
      doc.text('Solução:', 14, currentY);
      currentY += 5;
      
      doc.setFont('helvetica', 'normal');
      const solucaoLines = doc.splitTextToSize(record.solucao, pageWidth - 28);
      doc.text(solucaoLines, 14, currentY);
      currentY += solucaoLines.length * 5 + 2;
    }

    // Fotos
    if (record.fotos && record.fotos.length > 0) {
      currentY += 4;
      
      // Verificar se há espaço para fotos
      if (currentY > pageHeight - 90) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.text('Fotos do Atendimento:', 14, currentY);
      currentY += 6;

      const photoWidth = 80;
      const photoHeight = 60;
      const margin = 10;
      let photosPerRow = 2;
      let xPosition = 14;
      let yPosition = currentY;

      for (let j = 0; j < record.fotos.length; j++) {
        try {
          const photoBase64 = await imageUrlToBase64Cached(record.fotos[j].url);
          
          // Verificar se precisa de nova linha
          if (j > 0 && j % photosPerRow === 0) {
            xPosition = 14;
            yPosition += photoHeight + margin;
            
            // Verificar se precisa de nova página
            if (yPosition + photoHeight > pageHeight - 20) {
              doc.addPage();
              yPosition = 20;
            }
          }

          doc.addImage(photoBase64, 'JPEG', xPosition, yPosition, photoWidth, photoHeight);
          xPosition += photoWidth + margin;
        } catch (error) {
          console.error('Erro ao carregar foto:', error);
        }
      }

      currentY = yPosition + photoHeight + 10;
    }

    // Linha separadora
    currentY += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 8;
  }

  // Rodapé em todas as páginas
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // ============= SALVAR PDF =============
  const dataAtual = format(new Date(), 'yyyy-MM-dd');
  const fileName = `atendimentos_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${dataAtual}.pdf`;
  doc.save(fileName);
};
