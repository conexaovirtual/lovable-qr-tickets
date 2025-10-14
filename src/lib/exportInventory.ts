export const exportInventoryToCSV = (assets: any[]) => {
  const headers = [
    'Empresa',
    'Tipo',
    'Fabricante',
    'Modelo',
    'Serial',
    'Tag',
    'Estado',
    'Processador',
    'RAM (GB)',
    'Tipo RAM',
    'Armazenamento (GB)',
    'Tipo Armazenamento',
    'Placa de Vídeo',
    'Sistema Operacional',
    'Local',
    'Setor',
    'Data Compra',
    'Garantia Até'
  ];

  const rows = assets.map(asset => [
    asset.company?.nome_fantasia || '',
    asset.tipo || '',
    asset.fabricante || '',
    asset.modelo || '',
    asset.numero_serie || '',
    asset.tag_patrimonial || '',
    asset.estado || '',
    asset.configuracoes?.processador || '',
    asset.configuracoes?.memoria_ram_gb || '',
    asset.configuracoes?.memoria_ram_tipo || '',
    asset.configuracoes?.armazenamento_principal_gb || '',
    asset.configuracoes?.armazenamento_principal_tipo || '',
    asset.configuracoes?.placa_video || '',
    asset.sistema_operacional || '',
    asset.local || '',
    asset.setor || '',
    asset.data_compra || '',
    asset.garantia_fim || ''
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
