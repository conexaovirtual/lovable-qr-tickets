import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { imageUrlToBase64 } from '@/lib/imageUtils';

export const generateServiceOrderPDF = async (serviceOrder: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Cabeçalho
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(14);
  doc.text(`OS Nº ${serviceOrder.numero_os}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;
  
  // Linha separadora
  doc.setLineWidth(0.5);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  // Dados da empresa cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 20, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(serviceOrder.companies?.nome_fantasia || 'N/A', 20, yPos);
  
  if (serviceOrder.companies?.cnpj) {
    yPos += 6;
    doc.setFontSize(9);
    doc.text(`CNPJ: ${serviceOrder.companies.cnpj}`, 20, yPos);
  }
  
  if (serviceOrder.companies?.endereco) {
    yPos += 5;
    doc.text(`Endereço: ${serviceOrder.companies.endereco}`, 20, yPos);
  }
  
  yPos += 10;

  // Dados do chamado (se houver)
  if (serviceOrder.tickets) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Chamado: #${serviceOrder.tickets.numero}`, 20, yPos);
    
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Título: ${serviceOrder.tickets.titulo}`, 20, yPos);
    
    yPos += 10;
  }

  // Técnico responsável
  doc.setFont('helvetica', 'bold');
  doc.text(`Técnico Responsável: ${serviceOrder.profiles?.nome || 'N/A'}`, 20, yPos);
  
  yPos += 10;

  // Tipo de serviço e prioridade
  doc.setFont('helvetica', 'normal');
  doc.text(`Tipo de Serviço: ${serviceOrder.tipo_servico || 'N/A'}`, 20, yPos);
  yPos += 6;
  doc.text(`Prioridade: ${serviceOrder.prioridade || 'N/A'}`, 20, yPos);
  yPos += 10;

  // Datas
  const dataEmissao = format(new Date(serviceOrder.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Data de Emissão: ${dataEmissao}`, 20, yPos);
  
  yPos += 6;
  if (serviceOrder.data_agendada) {
    const dataAgendada = format(new Date(serviceOrder.data_agendada), "dd/MM/yyyy", { locale: ptBR });
    doc.text(`Data Agendada: ${dataAgendada} às ${serviceOrder.hora_agendada?.slice(0, 5) || 'N/A'}`, 20, yPos);
    yPos += 6;
  }

  if (serviceOrder.data_execucao) {
    const dataExecucao = format(new Date(serviceOrder.data_execucao), 'dd/MM/yyyy', { locale: ptBR });
    doc.text(`Data de Execução: ${dataExecucao}`, 20, yPos);
    yPos += 6;
  }
  
  yPos += 10;

  // Linha separadora
  doc.setLineWidth(0.5);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  // Serviços realizados
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SERVIÇOS REALIZADOS', 20, yPos);
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const splitText = doc.splitTextToSize(serviceOrder.descricao_servicos, pageWidth - 40);
  doc.text(splitText, 20, yPos);
  yPos += splitText.length * 5 + 10;

  // Endereço de atendimento (se houver)
  if (serviceOrder.endereco_atendimento) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('LOCAL DE ATENDIMENTO', 20, yPos);
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const enderecoText = doc.splitTextToSize(serviceOrder.endereco_atendimento, pageWidth - 40);
    doc.text(enderecoText, 20, yPos);
    yPos += enderecoText.length * 5 + 5;
    if (serviceOrder.contato_local) {
      doc.text(`Contato: ${serviceOrder.contato_local} ${serviceOrder.telefone_contato ? `- ${serviceOrder.telefone_contato}` : ''}`, 20, yPos);
      yPos += 5;
    }
    yPos += 5;
  }

  // Linha separadora
  doc.setLineWidth(0.5);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  // Custos
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOS', 20, yPos);
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tempo Gasto: ${serviceOrder.tempo_gasto_horas} hora(s)`, 20, yPos);
  
  yPos += 6;
  doc.text(`Custo de Peças: R$ ${serviceOrder.custo_pecas?.toFixed(2) || '0.00'}`, 20, yPos);
  
  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Custo Total: R$ ${serviceOrder.custo_total?.toFixed(2) || '0.00'}`, 20, yPos);
  
  yPos += 15;

  // Observações (se houver)
  if (serviceOrder.observacoes) {
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', 20, yPos);
    
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obsText = doc.splitTextToSize(serviceOrder.observacoes, pageWidth - 40);
    doc.text(obsText, 20, yPos);
    yPos += obsText.length * 5 + 15;
  }

  // Fotos do Serviço (se houver)
  if (serviceOrder.fotos && Array.isArray(serviceOrder.fotos) && serviceOrder.fotos.length > 0) {
    // Verificar se precisa de nova página
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }
    
    // Título da seção
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('FOTOS DO SERVIÇO EXECUTADO', 20, yPos);
    yPos += 10;

    // Configurações do grid 2x2
    const photoWidth = 80;
    const photoHeight = 60;
    const margin = 10;
    const startX = 20;
    let currentX = startX;
    let currentY = yPos;
    let photosInRow = 0;

    // Converter e adicionar cada foto
    for (let i = 0; i < serviceOrder.fotos.length; i++) {
      const foto = serviceOrder.fotos[i];
      
      try {
        // Converter URL para base64
        const base64Image = await imageUrlToBase64(foto.url);
        
        // Verificar se precisa de nova linha (2 fotos por linha)
        if (photosInRow === 2) {
          currentX = startX;
          currentY += photoHeight + margin;
          photosInRow = 0;
          
          // Verificar se precisa de nova página
          if (currentY + photoHeight > 250) {
            doc.addPage();
            currentY = 20;
          }
        }
        
        // Adicionar foto no PDF
        doc.addImage(base64Image, 'JPEG', currentX, currentY, photoWidth, photoHeight);
        
        // Adicionar legenda (nome do arquivo)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const caption = foto.name || `Foto ${i + 1}`;
        doc.text(caption.substring(0, 30), currentX, currentY + photoHeight + 4);
        
        // Próxima posição
        currentX += photoWidth + margin;
        photosInRow++;
        
      } catch (error) {
        console.error(`Erro ao adicionar foto ${i + 1}:`, error);
        // Continuar mesmo se uma foto falhar
      }
    }
    
    // Atualizar yPos para após todas as fotos
    yPos = currentY + photoHeight + 20;
  }

  // Assinatura (posição dinâmica após fotos)
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Se yPos está muito perto do fim da página, adicionar nova página
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 20;
  }
  
  yPos += 10;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Data: ____/____/______', 20, yPos);
  
  yPos += 15;
  doc.line(20, yPos, 90, yPos);
  yPos += 5;
  doc.text('Assinatura do Cliente', 30, yPos);

  // Salvar PDF
  const fileName = `OS_${serviceOrder.numero_os}_${serviceOrder.companies?.nome_fantasia || 'Ordem'}.pdf`;
  doc.save(fileName);
};
