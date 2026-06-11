#!/bin/bash

set -e

VPS_USER="root"
VPS_HOST="69.62.100.6"
VPS_PATH="/var/www/helpdesk"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 Fazendo build..."
cd "$PROJECT_DIR"
npm run build

echo "📦 Enviando arquivos para a VPS..."
scp -r "$PROJECT_DIR/dist/." "$VPS_USER@$VPS_HOST:$VPS_PATH/"

echo "✅ Deploy concluído! Acesse https://conexaovirtual.cloud"
