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
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 20;

  // ========== LOGO ==========
  const logoBase64 = await getConexaoVirtualLogo();
  if (logoBase64) {
    try {
      // Logo no canto superior direito (50x19mm)
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
    ['Data', formatDateBR(record.data_atendimento)],
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
    // Nova página se necessário
    if (currentY > 180) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fotos do Atendimento (${record.fotos.length})`, 14, currentY);
    currentY += 10;

    // Configurações do grid 2x2
    const photoWidth = 80;  // Largura da foto
    const photoHeight = 60; // Altura da foto
    const margin = 10;      // Espaçamento entre fotos
    const startX = 20;      // Margem esquerda
    let currentX = startX;
    let photoY = currentY;
    let photosInRow = 0;

    // Converter e adicionar cada foto
    for (let i = 0; i < record.fotos.length; i++) {
      const foto = record.fotos[i];
      
      try {
        // Converter URL para base64
        const base64Image = await imageUrlToBase64(foto.url);
        
        // Verificar se precisa de nova linha (2 fotos por linha)
        if (photosInRow === 2) {
          currentX = startX;
          photoY += photoHeight + margin + 5; // +5 para legenda
          photosInRow = 0;
          
          // Verificar se precisa de nova página
          if (photoY + photoHeight > 250) {
            doc.addPage();
            photoY = 20;
          }
        }
        
        // Adicionar foto no PDF
        doc.addImage(base64Image, 'JPEG', currentX, photoY, photoWidth, photoHeight);
        
        // Adicionar legenda (nome do arquivo)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const caption = foto.name || `Foto ${i + 1}`;
        doc.text(caption.substring(0, 30), currentX, photoY + photoHeight + 4);
        
        // Próxima posição
        currentX += photoWidth + margin;
        photosInRow++;
        
      } catch (error) {
        console.error(`Erro ao adicionar foto ${i + 1}:`, error);
        
        // Adicionar placeholder em caso de erro
        doc.setFillColor(240, 240, 240);
        doc.rect(currentX, photoY, photoWidth, photoHeight, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('Erro ao carregar', currentX + photoWidth/2, photoY + photoHeight/2, { align: 'center' });
        
        currentX += photoWidth + margin;
        photosInRow++;
      }
    }
    
    // Atualizar currentY para após todas as fotos
    currentY = photoY + photoHeight + 15;
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
