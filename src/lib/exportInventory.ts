import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportInventoryToCSV = (assets: any[]) => {
  const headers = [
    'Empresa',
    'Tipo',
    'Fabricante',
    'Modelo',
    'Serial',
    'Processador',
    'RAM (GB)',
    'Tipo RAM',
    'Armazenamento (GB)',
    'Tipo Armazenamento',
    'Placa de Vídeo',
    'Sistema Operacional',
    'Local'
  ];

  const rows = assets.map(asset => [
    asset.company?.nome_fantasia || '',
    asset.tipo || '',
    asset.fabricante || '',
    asset.modelo || '',
    asset.numero_serie || '',
    asset.configuracoes?.processador || '',
    asset.configuracoes?.memoria_ram_gb || '',
    asset.configuracoes?.memoria_ram_tipo || '',
    asset.configuracoes?.armazenamento_principal_gb || '',
    asset.configuracoes?.armazenamento_principal_tipo || '',
    asset.configuracoes?.placa_video || '',
    asset.sistema_operacional || '',
    asset.local || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

export const exportInventoryToPDF = (assets: any[]) => {
  const doc = new jsPDF('landscape');
  
  // Cabeçalho do documento
  doc.setFontSize(18);
  doc.text('Relatório de Inventário de Ativos', 14, 20);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
  doc.text(`Total de ativos: ${assets.length}`, 14, 34);
  
  // Preparar dados da tabela
  const tableData = assets.map(asset => [
    asset.company?.nome_fantasia || '-',
    asset.tipo || '-',
    asset.fabricante || '-',
    asset.modelo || '-',
    asset.numero_serie || '-',
    asset.tag_patrimonial || '-',
    asset.estado || '-',
    asset.configuracoes?.processador || '-',
    `${asset.configuracoes?.memoria_ram_gb || '-'} GB`,
    asset.sistema_operacional || '-',
    asset.local || '-',
    asset.data_compra ? new Date(asset.data_compra).toLocaleDateString('pt-BR') : '-'
  ]);
  
  // Gerar tabela com autoTable
  autoTable(doc, {
    head: [[
      'Empresa',
      'Tipo',
      'Fabricante',
      'Modelo',
      'Serial',
      'Tag',
      'Estado',
      'Processador',
      'RAM',
      'S.O.',
      'Local',
      'Compra'
    ]],
    body: tableData,
    startY: 40,
    styles: { 
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { top: 40 }
  });
  
  // Salvar PDF
  doc.save(`inventario_${new Date().toISOString().split('T')[0]}.pdf`);
};
