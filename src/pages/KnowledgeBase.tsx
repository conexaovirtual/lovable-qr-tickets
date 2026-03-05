import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, BookOpen, ThumbsUp, Eye, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface KnowledgeArticle {
  id: string;
  ticket_id: string | null;
  titulo: string;
  problema: string;
  solucao: string;
  tags: string[];
  categoria: string | null;
  visualizacoes: number;
  util_count: number;
  created_at: string;
}

export default function KnowledgeBase() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && profile) loadArticles();
  }, [authLoading, profile]);

  const loadArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setArticles(data as KnowledgeArticle[]);
    setLoading(false);
  };

  const filteredArticles = articles.filter(a => {
    const matchesSearch = !search || 
      a.titulo.toLowerCase().includes(search.toLowerCase()) ||
      a.problema.toLowerCase().includes(search.toLowerCase()) ||
      a.solucao.toLowerCase().includes(search.toLowerCase()) ||
      a.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !selectedCategory || a.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(articles.map(a => a.categoria).filter(Boolean))];

  const handleUseful = async (articleId: string) => {
    await supabase
      .from('knowledge_articles')
      .update({ util_count: articles.find(a => a.id === articleId)!.util_count + 1 })
      .eq('id', articleId);
    setArticles(prev => prev.map(a => a.id === articleId ? { ...a, util_count: a.util_count + 1 } : a));
  };

  if (authLoading) return <div className="bg-background"><Skeleton className="h-96 m-4" /></div>;

  return (
    <div className="bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Base de Conhecimento</h1>
          </div>
          <p className="text-muted-foreground">Artigos gerados automaticamente por IA a partir de chamados resolvidos</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar artigos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={!selectedCategory ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(null)}
            >
              Todos
            </Badge>
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {/* Articles */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {search ? 'Nenhum artigo encontrado para esta busca.' : 'Nenhum artigo na base de conhecimento ainda. Artigos serão gerados automaticamente ao fechar chamados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredArticles.map(article => (
              <Card key={article.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{article.titulo}</CardTitle>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        {article.categoria && <Badge variant="secondary">{article.categoria}</Badge>}
                        <span className="flex items-center gap-1 text-xs">
                          <Eye className="h-3 w-3" /> {article.visualizacoes}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <ThumbsUp className="h-3 w-3" /> {article.util_count}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Problema</p>
                    <p className="text-sm">{article.problema}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Solução</p>
                    <p className="text-sm whitespace-pre-wrap">{article.solucao}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-1 flex-wrap">
                      {article.tags?.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUseful(article.id)}
                      className="gap-1"
                    >
                      <ThumbsUp className="h-3 w-3" /> Útil
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
