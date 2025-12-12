import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { imageUrlToBase64Cached } from './imageUtils';
import { formatDateBR } from './formatters';

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

export const exportDailyServicesToPDF = async (
  records: any[], 
  stats: DailyServiceStats,
  filters?: { dataInicio?: string; dataFim?: string }
) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 20;

  // ========== LOGO ==========
  const logoBase64 = await getConexaoVirtualLogo();
  if (logoBase64) {
    try {
      // Logo no canto superior direito (60x23mm)
      doc.addImage(logoBase64, 'PNG', pageWidth - 70, 10, 60, 23);
    } catch (error) {
      console.error('Erro ao adicionar logo:', error);
    }
  }

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

  // Adicionar informações sobre o período filtrado
  if (filters?.dataInicio || filters?.dataFim) {
    const periodoText = filters.dataInicio && filters.dataFim
      ? `Período: ${format(new Date(filters.dataInicio), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(filters.dataFim), 'dd/MM/yyyy', { locale: ptBR })}`
      : filters.dataInicio
      ? `A partir de: ${format(new Date(filters.dataInicio), 'dd/MM/yyyy', { locale: ptBR })}`
      : `Até: ${format(new Date(filters.dataFim), 'dd/MM/yyyy', { locale: ptBR })}`;
    
    doc.text(periodoText, 14, currentY);
    currentY += 6;
  }

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
    const dataFormatada = formatDateBR(record.data_atendimento);
    
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

// ============= EXPORTAR COM FOTOS =============
export const exportDailyServicesWithPhotosToPDF = async (
  records: any[], 
  stats: DailyServiceStats,
  filters?: { dataInicio?: string; dataFim?: string }
) => {
  const doc = new jsPDF('landscape');
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
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Completo de Atendimentos', 14, currentY);
  currentY += 10;

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

  // ============= ESTATÍSTICAS RESUMIDAS =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', 14, currentY);
  currentY += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Total de Atendimentos: ${stats.total}`, 14, currentY);
  doc.text(`Concluídos: ${stats.concluidos}`, 80, currentY);
  doc.text(`Em Andamento: ${stats.em_andamento}`, 140, currentY);
  doc.text(`Pendentes: ${stats.pendentes}`, 200, currentY);
  currentY += 6;

  doc.text(`WhatsApp: ${stats.whatsapp}`, 14, currentY);
  doc.text(`Ligações: ${stats.ligacao}`, 80, currentY);
  doc.text(`Visitas Técnicas: ${stats.visita_tecnica}`, 140, currentY);
  doc.text(
    `Tempo Médio: ${Math.floor(stats.tempo_medio / 60)}h ${stats.tempo_medio % 60}m`,
    200,
    currentY
  );
  currentY += 10;

  // ============= TABELA RESUMIDA =============
  const tableData = records.map(record => {
    const dataFormatada = formatDateBR(record.data_atendimento);
    
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
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      2: { cellWidth: 60 },
      3: { cellWidth: 50 },
      4: { cellWidth: 40 },
      5: { cellWidth: 30 },
      6: { cellWidth: 30 }
    },
    margin: { top: 40, left: 14, right: 14 }
  });

  // ============= DETALHES COM FOTOS (máximo 10 atendimentos) =============
  const recordsWithPhotos = records.filter(r => r.fotos && r.fotos.length > 0).slice(0, 10);
  
  if (recordsWithPhotos.length > 0) {
    doc.addPage();
    currentY = 20;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Atendimentos Detalhados com Fotos', 14, currentY);
    currentY += 10;

    for (let i = 0; i < recordsWithPhotos.length; i++) {
      const record = recordsWithPhotos[i];

      // Nova página para cada atendimento
      if (i > 0) {
        doc.addPage();
        currentY = 20;
      }

      // Título do atendimento
      doc.setFillColor(59, 130, 246);
      doc.rect(14, currentY - 5, pageWidth - 28, 10, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${record.titulo}`, 16, currentY + 2);
      currentY += 12;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      // Informações básicas
      doc.text(
        `Data: ${formatDateBR(record.data_atendimento)} | Técnico: ${record.profiles?.nome || '-'}`,
        14,
        currentY
      );
      currentY += 6;

      // Descrição
      doc.setFont('helvetica', 'bold');
      doc.text('Descrição:', 14, currentY);
      currentY += 5;
      
      doc.setFont('helvetica', 'normal');
      const descricaoLines = doc.splitTextToSize(record.descricao || '-', pageWidth - 28);
      doc.text(descricaoLines, 14, currentY);
      currentY += descricaoLines.length * 5 + 4;

      // Solução
      if (record.solucao) {
        doc.setFont('helvetica', 'bold');
        doc.text('Solução:', 14, currentY);
        currentY += 5;
        
        doc.setFont('helvetica', 'normal');
        const solucaoLines = doc.splitTextToSize(record.solucao, pageWidth - 28);
        doc.text(solucaoLines, 14, currentY);
        currentY += solucaoLines.length * 5 + 4;
      }

      // Fotos em grid 3x3
      if (record.fotos && record.fotos.length > 0) {
        currentY += 4;
        doc.setFont('helvetica', 'bold');
        doc.text('Fotos do Atendimento:', 14, currentY);
        currentY += 6;

        const photoWidth = 85;
        const photoHeight = 64;
        const margin = 8;
        const photosPerRow = 3;
        let xPosition = 14;
        let yPosition = currentY;

        for (let j = 0; j < record.fotos.length; j++) {
          try {
            const photoBase64 = await imageUrlToBase64Cached(record.fotos[j].url);
            
            if (j > 0 && j % photosPerRow === 0) {
              xPosition = 14;
              yPosition += photoHeight + margin;
              
              if (yPosition + photoHeight > pageHeight - 20) {
                doc.addPage();
                yPosition = 20;
                xPosition = 14;
              }
            }

            doc.addImage(photoBase64, 'JPEG', xPosition, yPosition, photoWidth, photoHeight);
            xPosition += photoWidth + margin;
          } catch (error) {
            console.error('Erro ao carregar foto:', error);
          }
        }
      }
    }
  }

  // Rodapé em todas as páginas
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // ============= SALVAR PDF =============
  const dataAtual = format(new Date(), 'yyyy-MM-dd');
  doc.save(`atendimentos-completo_${dataAtual}.pdf`);
};
