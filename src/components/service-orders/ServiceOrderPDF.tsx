import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const generateServiceOrderPDF = (serviceOrder: any) => {
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

  // Dados do chamado
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Chamado: #${serviceOrder.tickets?.numero}`, 20, yPos);
  
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Título: ${serviceOrder.tickets?.titulo}`, 20, yPos);
  
  yPos += 10;

  // Técnico responsável
  doc.setFont('helvetica', 'bold');
  doc.text(`Técnico Responsável: ${serviceOrder.profiles?.nome || 'N/A'}`, 20, yPos);
  
  yPos += 10;

  // Datas
  doc.setFont('helvetica', 'normal');
  const dataEmissao = format(new Date(serviceOrder.data_emissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Data de Emissão: ${dataEmissao}`, 20, yPos);
  
  yPos += 6;
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

  // Assinatura (na parte inferior da página)
  const bottomY = doc.internal.pageSize.getHeight() - 40;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Data: ____/____/______', 20, bottomY);
  
  doc.line(20, bottomY + 15, 90, bottomY + 15);
  doc.text('Assinatura do Cliente', 30, bottomY + 20);

  // Salvar PDF
  const fileName = `OS_${serviceOrder.numero_os}_${serviceOrder.companies?.nome_fantasia || 'Ordem'}.pdf`;
  doc.save(fileName);
};
