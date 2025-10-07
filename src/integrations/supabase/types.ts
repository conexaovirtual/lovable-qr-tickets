export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          company_id: string
          configuracoes: Json | null
          created_at: string | null
          data_compra: string | null
          estado: Database["public"]["Enums"]["asset_status"] | null
          fabricante: string | null
          garantia_fim: string | null
          id: string
          local: string | null
          modelo: string | null
          numero_serie: string | null
          observacoes: string | null
          qrcode_token: string | null
          setor: string | null
          sistema_operacional: string | null
          tag_patrimonial: string | null
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at: string | null
        }
        Insert: {
          company_id: string
          configuracoes?: Json | null
          created_at?: string | null
          data_compra?: string | null
          estado?: Database["public"]["Enums"]["asset_status"] | null
          fabricante?: string | null
          garantia_fim?: string | null
          id?: string
          local?: string | null
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          qrcode_token?: string | null
          setor?: string | null
          sistema_operacional?: string | null
          tag_patrimonial?: string | null
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          configuracoes?: Json | null
          created_at?: string | null
          data_compra?: string | null
          estado?: Database["public"]["Enums"]["asset_status"] | null
          fabricante?: string | null
          garantia_fim?: string | null
          id?: string
          local?: string | null
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          qrcode_token?: string | null
          setor?: string | null
          sistema_operacional?: string | null
          tag_patrimonial?: string | null
          tipo?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      categories: {
        Row: {
          cor: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string
          razao_social: string | null
          sla_primeiro_atendimento_horas: number | null
          sla_solucao_horas: number | null
          status: boolean | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia: string
          razao_social?: string | null
          sla_primeiro_atendimento_horas?: number | null
          sla_solucao_horas?: number | null
          status?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string
          razao_social?: string | null
          sla_primeiro_atendimento_horas?: number | null
          sla_solucao_horas?: number | null
          status?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          phone_visibility:
            | Database["public"]["Enums"]["phone_visibility"]
            | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          id: string
          nome: string
          phone_visibility?:
            | Database["public"]["Enums"]["phone_visibility"]
            | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          phone_visibility?:
            | Database["public"]["Enums"]["phone_visibility"]
            | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["company_id"]
          },
        ]
      }
      profiles_company_mapping: {
        Row: {
          company_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          comentario: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          comentario: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id: string
          user_id: string
        }
        Update: {
          comentario?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          avaliacao: number | null
          canal: string | null
          category_id: string | null
          comentario_avaliacao: string | null
          company_id: string
          created_at: string | null
          custo_pecas: number | null
          data_fechamento: string | null
          data_primeiro_atendimento: string | null
          data_solucao: string | null
          descricao: string
          id: string
          impacto: Database["public"]["Enums"]["impact_level"] | null
          numero: number
          prioridade: Database["public"]["Enums"]["priority_level"] | null
          sla_atendimento_limite: string | null
          sla_solucao_limite: string | null
          solicitante_id: string
          solucao: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subcategory_id: string | null
          tecnico_id: string | null
          tempo_gasto_horas: number | null
          titulo: string
          updated_at: string | null
          urgencia: Database["public"]["Enums"]["urgency_level"] | null
        }
        Insert: {
          asset_id?: string | null
          avaliacao?: number | null
          canal?: string | null
          category_id?: string | null
          comentario_avaliacao?: string | null
          company_id: string
          created_at?: string | null
          custo_pecas?: number | null
          data_fechamento?: string | null
          data_primeiro_atendimento?: string | null
          data_solucao?: string | null
          descricao: string
          id?: string
          impacto?: Database["public"]["Enums"]["impact_level"] | null
          numero?: number
          prioridade?: Database["public"]["Enums"]["priority_level"] | null
          sla_atendimento_limite?: string | null
          sla_solucao_limite?: string | null
          solicitante_id: string
          solucao?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory_id?: string | null
          tecnico_id?: string | null
          tempo_gasto_horas?: number | null
          titulo: string
          updated_at?: string | null
          urgencia?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Update: {
          asset_id?: string | null
          avaliacao?: number | null
          canal?: string | null
          category_id?: string | null
          comentario_avaliacao?: string | null
          company_id?: string
          created_at?: string | null
          custo_pecas?: number | null
          data_fechamento?: string | null
          data_primeiro_atendimento?: string | null
          data_solucao?: string | null
          descricao?: string
          id?: string
          impacto?: Database["public"]["Enums"]["impact_level"] | null
          numero?: number
          prioridade?: Database["public"]["Enums"]["priority_level"] | null
          sla_atendimento_limite?: string | null
          sla_solucao_limite?: string | null
          solicitante_id?: string
          solucao?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subcategory_id?: string | null
          tecnico_id?: string | null
          tempo_gasto_horas?: number | null
          titulo?: string
          updated_at?: string | null
          urgencia?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tickets_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      companies_basic: {
        Row: {
          created_at: string | null
          id: string | null
          nome_fantasia: string | null
          status: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          nome_fantasia?: string | null
          status?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          nome_fantasia?: string | null
          status?: boolean | null
        }
        Relationships: []
      }
      companies_safe: {
        Row: {
          cnpj: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string | null
          nome_fantasia: string | null
          razao_social: string | null
          sla_primeiro_atendimento_horas: number | null
          sla_solucao_horas: number | null
          status: boolean | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: never
          created_at?: string | null
          email?: never
          endereco?: never
          id?: string | null
          nome_fantasia?: string | null
          razao_social?: never
          sla_primeiro_atendimento_horas?: never
          sla_solucao_horas?: never
          status?: boolean | null
          telefone?: never
          updated_at?: string | null
        }
        Update: {
          cnpj?: never
          created_at?: string | null
          email?: never
          endereco?: never
          id?: string | null
          nome_fantasia?: string | null
          razao_social?: never
          sla_primeiro_atendimento_horas?: never
          sla_solucao_horas?: never
          status?: boolean | null
          telefone?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      company_statistics: {
        Row: {
          ativos_baixados: number | null
          ativos_em_uso: number | null
          ativos_estoque: number | null
          ativos_manutencao: number | null
          cnpj: string | null
          company_id: string | null
          media_avaliacao: number | null
          nome_fantasia: string | null
          sla_primeiro_atendimento_horas: number | null
          sla_solucao_horas: number | null
          status: boolean | null
          tempo_medio_resolucao_horas: number | null
          tickets_em_atendimento: number | null
          tickets_fechados: number | null
          tickets_novos: number | null
          tickets_resolvidos: number | null
          tickets_sla_violado: number | null
          total_ativos: number | null
          total_tickets: number | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          nome: string | null
          phone_visibility:
            | Database["public"]["Enums"]["phone_visibility"]
            | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          nome?: string | null
          phone_visibility?:
            | Database["public"]["Enums"]["phone_visibility"]
            | null
          telefone?: never
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          nome?: string | null
          phone_visibility?:
            | Database["public"]["Enums"]["phone_visibility"]
            | null
          telefone?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_basic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_statistics"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Functions: {
      calculate_priority: {
        Args: {
          p_impacto: Database["public"]["Enums"]["impact_level"]
          p_urgencia: Database["public"]["Enums"]["urgency_level"]
        }
        Returns: Database["public"]["Enums"]["priority_level"]
      }
      can_view_asset_details: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_view_financial_data: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_view_phone: {
        Args: { target_user_id: string; viewer_user_id: string }
        Returns: boolean
      }
      get_user_company_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      log_phone_access_attempt: {
        Args: {
          access_granted: boolean
          target_user_id: string
          viewer_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      asset_status: "em_uso" | "estoque" | "manutencao" | "baixado"
      asset_type:
        | "desktop"
        | "notebook"
        | "impressora"
        | "monitor"
        | "roteador"
        | "switch"
        | "servidor"
        | "periferico"
        | "outro"
      impact_level: "alto" | "medio" | "baixo"
      phone_visibility: "everyone" | "managers_only" | "private"
      priority_level: "critica" | "alta" | "media" | "baixa"
      ticket_status:
        | "novo"
        | "triagem"
        | "em_atendimento"
        | "aguardando_usuario"
        | "aguardando_peca"
        | "resolvido"
        | "validando_cliente"
        | "fechado"
      urgency_level: "alta" | "media" | "baixa"
      user_role: "admin_provedor" | "tecnico" | "gestor_cliente" | "solicitante"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_status: ["em_uso", "estoque", "manutencao", "baixado"],
      asset_type: [
        "desktop",
        "notebook",
        "impressora",
        "monitor",
        "roteador",
        "switch",
        "servidor",
        "periferico",
        "outro",
      ],
      impact_level: ["alto", "medio", "baixo"],
      phone_visibility: ["everyone", "managers_only", "private"],
      priority_level: ["critica", "alta", "media", "baixa"],
      ticket_status: [
        "novo",
        "triagem",
        "em_atendimento",
        "aguardando_usuario",
        "aguardando_peca",
        "resolvido",
        "validando_cliente",
        "fechado",
      ],
      urgency_level: ["alta", "media", "baixa"],
      user_role: ["admin_provedor", "tecnico", "gestor_cliente", "solicitante"],
    },
  },
} as const
