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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acuerdos_reunion: {
        Row: {
          ajustesUsuario: number
          area_negocio: string
          creado_at: string
          descripcion: string
          estado: string
          fecha: string | null
          historialFechas: Json
          id: string
          notificada: boolean
          recordada: boolean
          responsable_email: string
          responsable_nombre: string | null
          resultado: string | null
          reunion_id: string | null
        }
        Insert: {
          ajustesUsuario?: number
          area_negocio?: string
          creado_at?: string
          descripcion?: string
          estado?: string
          fecha?: string | null
          historialFechas?: Json
          id?: string
          notificada?: boolean
          recordada?: boolean
          responsable_email?: string
          responsable_nombre?: string | null
          resultado?: string | null
          reunion_id?: string | null
        }
        Update: {
          ajustesUsuario?: number
          area_negocio?: string
          creado_at?: string
          descripcion?: string
          estado?: string
          fecha?: string | null
          historialFechas?: Json
          id?: string
          notificada?: boolean
          recordada?: boolean
          responsable_email?: string
          responsable_nombre?: string | null
          resultado?: string | null
          reunion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acuerdos_reunion_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "acuerdos_reunion_reunion_id_fkey"
            columns: ["reunion_id"]
            isOneToOne: false
            referencedRelation: "reuniones"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_pins: {
        Row: {
          pin: string
          rol: string
        }
        Insert: {
          pin: string
          rol: string
        }
        Update: {
          pin?: string
          rol?: string
        }
        Relationships: []
      }
      areas_negocio: {
        Row: {
          activo: boolean
          codigo: string
          creado_at: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          codigo: string
          creado_at?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          codigo?: string
          creado_at?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      configuracion_sistema: {
        Row: {
          clave: string
          updated_at: string
          valor: string
        }
        Insert: {
          clave: string
          updated_at?: string
          valor: string
        }
        Update: {
          clave?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      coreografias: {
        Row: {
          acciones: Json
          area_id: string
          area_negocio: string
          calendar_event_id: string | null
          calendar_synced_fecha: string | null
          calendar_synced_hora: string | null
          fecha_revision: string | null
          hora_revision: string | null
          id: string
          kpi_id: string
          objetivo: string | null
          pais_code: string
          punto_control: string | null
          responsable: string | null
          situacion: string | null
          updated_at: string
        }
        Insert: {
          acciones?: Json
          area_id: string
          area_negocio?: string
          calendar_event_id?: string | null
          calendar_synced_fecha?: string | null
          calendar_synced_hora?: string | null
          fecha_revision?: string | null
          hora_revision?: string | null
          id?: string
          kpi_id: string
          objetivo?: string | null
          pais_code: string
          punto_control?: string | null
          responsable?: string | null
          situacion?: string | null
          updated_at?: string
        }
        Update: {
          acciones?: Json
          area_id?: string
          area_negocio?: string
          calendar_event_id?: string | null
          calendar_synced_fecha?: string | null
          calendar_synced_hora?: string | null
          fecha_revision?: string | null
          hora_revision?: string | null
          id?: string
          kpi_id?: string
          objetivo?: string | null
          pais_code?: string
          punto_control?: string | null
          responsable?: string | null
          situacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coreografias_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "coreografias_area_negocio_kpi_id_fkey"
            columns: ["area_negocio", "kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis_catalogo"
            referencedColumns: ["area_negocio", "kpi_id"]
          },
          {
            foreignKeyName: "coreografias_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "coreografias_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises_publico"
            referencedColumns: ["code"]
          },
        ]
      }
      kpis_adicionales: {
        Row: {
          acciones: Json
          area_id: string
          area_negocio: string
          calendar_event_id: string | null
          calendar_synced_fecha: string | null
          calendar_synced_hora: string | null
          definicion: string | null
          fecha_revision: string | null
          hora_revision: string | null
          id: string
          nombre: string | null
          objetivo: string | null
          orden: number
          pais_code: string
          punto_control: string | null
          responsable: string | null
          situacion: string | null
          updated_at: string
        }
        Insert: {
          acciones?: Json
          area_id: string
          area_negocio?: string
          calendar_event_id?: string | null
          calendar_synced_fecha?: string | null
          calendar_synced_hora?: string | null
          definicion?: string | null
          fecha_revision?: string | null
          hora_revision?: string | null
          id?: string
          nombre?: string | null
          objetivo?: string | null
          orden?: number
          pais_code: string
          punto_control?: string | null
          responsable?: string | null
          situacion?: string | null
          updated_at?: string
        }
        Update: {
          acciones?: Json
          area_id?: string
          area_negocio?: string
          calendar_event_id?: string | null
          calendar_synced_fecha?: string | null
          calendar_synced_hora?: string | null
          definicion?: string | null
          fecha_revision?: string | null
          hora_revision?: string | null
          id?: string
          nombre?: string | null
          objetivo?: string | null
          orden?: number
          pais_code?: string
          punto_control?: string | null
          responsable?: string | null
          situacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_adicionales_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "kpis_adicionales_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "kpis_adicionales_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises_publico"
            referencedColumns: ["code"]
          },
        ]
      }
      kpis_adicionales_log: {
        Row: {
          acciones: Json
          area_id: string
          area_negocio: string | null
          definicion: string | null
          deleted_at: string
          fecha_revision: string | null
          id: string
          nombre: string | null
          objetivo: string | null
          original_id: string | null
          pais_code: string
          punto_control: string | null
          responsable: string | null
          situacion: string | null
        }
        Insert: {
          acciones?: Json
          area_id: string
          area_negocio?: string | null
          definicion?: string | null
          deleted_at?: string
          fecha_revision?: string | null
          id?: string
          nombre?: string | null
          objetivo?: string | null
          original_id?: string | null
          pais_code: string
          punto_control?: string | null
          responsable?: string | null
          situacion?: string | null
        }
        Update: {
          acciones?: Json
          area_id?: string
          area_negocio?: string | null
          definicion?: string | null
          deleted_at?: string
          fecha_revision?: string | null
          id?: string
          nombre?: string | null
          objetivo?: string | null
          original_id?: string | null
          pais_code?: string
          punto_control?: string | null
          responsable?: string | null
          situacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_adicionales_log_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "kpis_adicionales_log_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "kpis_adicionales_log_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises_publico"
            referencedColumns: ["code"]
          },
        ]
      }
      kpis_catalogo: {
        Row: {
          activo: boolean
          area_id: string
          area_negocio: string
          definicion: string | null
          id: string
          kpi_id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          area_id: string
          area_negocio?: string
          definicion?: string | null
          id?: string
          kpi_id: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          area_id?: string
          area_negocio?: string
          definicion?: string | null
          id?: string
          kpi_id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_catalogo_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
        ]
      }
      paises: {
        Row: {
          code: string
          nombre: string
          pin: string
        }
        Insert: {
          code: string
          nombre: string
          pin: string
        }
        Update: {
          code?: string
          nombre?: string
          pin?: string
        }
        Relationships: []
      }
      perfiles_usuario: {
        Row: {
          area_negocio: string
          creado_at: string
          creado_por: string | null
          email: string
          es_admin: boolean
          es_admin_area: boolean
          es_admin_pais: boolean
          es_gerente_pais: boolean
          es_lider: boolean
          es_regional: boolean
          id: string
          nombre: string
          pais_code: string | null
          user_id: string | null
        }
        Insert: {
          area_negocio?: string
          creado_at?: string
          creado_por?: string | null
          email: string
          es_admin?: boolean
          es_admin_area?: boolean
          es_admin_pais?: boolean
          es_gerente_pais?: boolean
          es_lider?: boolean
          es_regional?: boolean
          id?: string
          nombre?: string
          pais_code?: string | null
          user_id?: string | null
        }
        Update: {
          area_negocio?: string
          creado_at?: string
          creado_por?: string | null
          email?: string
          es_admin?: boolean
          es_admin_area?: boolean
          es_admin_pais?: boolean
          es_gerente_pais?: boolean
          es_lider?: boolean
          es_regional?: boolean
          id?: string
          nombre?: string
          pais_code?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_usuario_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "perfiles_usuario_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "perfiles_usuario_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises_publico"
            referencedColumns: ["code"]
          },
        ]
      }
      proyectos_especiales: {
        Row: {
          acciones: Json
          area_negocio: string
          calendar_event_id: string | null
          calendar_synced_fecha: string | null
          calendar_synced_hora: string | null
          descripcion: string | null
          estado: string | null
          fecha_seguimiento: string | null
          hora_seguimiento: string | null
          id: string
          nombre: string | null
          orden: number
          pais_code: string
          responsable: string | null
          updated_at: string
        }
        Insert: {
          acciones?: Json
          area_negocio?: string
          calendar_event_id?: string | null
          calendar_synced_fecha?: string | null
          calendar_synced_hora?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_seguimiento?: string | null
          hora_seguimiento?: string | null
          id?: string
          nombre?: string | null
          orden?: number
          pais_code: string
          responsable?: string | null
          updated_at?: string
        }
        Update: {
          acciones?: Json
          area_negocio?: string
          calendar_event_id?: string | null
          calendar_synced_fecha?: string | null
          calendar_synced_hora?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_seguimiento?: string | null
          hora_seguimiento?: string | null
          id?: string
          nombre?: string | null
          orden?: number
          pais_code?: string
          responsable?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_especiales_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "proyectos_especiales_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "proyectos_especiales_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises_publico"
            referencedColumns: ["code"]
          },
        ]
      }
      proyectos_especiales_log: {
        Row: {
          acciones: Json
          area_negocio: string | null
          deleted_at: string
          descripcion: string | null
          estado: string | null
          fecha_seguimiento: string | null
          hora_seguimiento: string | null
          id: string
          nombre: string | null
          original_id: string | null
          pais_code: string
          responsable: string | null
        }
        Insert: {
          acciones?: Json
          area_negocio?: string | null
          deleted_at?: string
          descripcion?: string | null
          estado?: string | null
          fecha_seguimiento?: string | null
          hora_seguimiento?: string | null
          id?: string
          nombre?: string | null
          original_id?: string | null
          pais_code: string
          responsable?: string | null
        }
        Update: {
          acciones?: Json
          area_negocio?: string | null
          deleted_at?: string
          descripcion?: string | null
          estado?: string | null
          fecha_seguimiento?: string | null
          hora_seguimiento?: string | null
          id?: string
          nombre?: string | null
          original_id?: string | null
          pais_code?: string
          responsable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_especiales_log_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
        ]
      }
      reuniones: {
        Row: {
          area_negocio: string
          creado_at: string
          creado_por_email: string | null
          creado_por_nombre: string | null
          desbloqueada_en: string | null
          envio_enviado_at: string | null
          envio_pendiente: boolean
          estado: string
          fecha: string | null
          historial_ediciones: Json
          id: string
          minuta: string | null
          pais_code: string | null
          participantes: Json
          titulo: string
          transcripcion: string
        }
        Insert: {
          area_negocio?: string
          creado_at?: string
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          desbloqueada_en?: string | null
          envio_enviado_at?: string | null
          envio_pendiente?: boolean
          estado?: string
          fecha?: string | null
          historial_ediciones?: Json
          id?: string
          minuta?: string | null
          pais_code?: string | null
          participantes?: Json
          titulo?: string
          transcripcion?: string
        }
        Update: {
          area_negocio?: string
          creado_at?: string
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          desbloqueada_en?: string | null
          envio_enviado_at?: string | null
          envio_pendiente?: boolean
          estado?: string
          fecha?: string | null
          historial_ediciones?: Json
          id?: string
          minuta?: string | null
          pais_code?: string | null
          participantes?: Json
          titulo?: string
          transcripcion?: string
        }
        Relationships: [
          {
            foreignKeyName: "reuniones_area_negocio_fkey"
            columns: ["area_negocio"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "reuniones_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "reuniones_pais_code_fkey"
            columns: ["pais_code"]
            isOneToOne: false
            referencedRelation: "paises_publico"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      paises_publico: {
        Row: {
          code: string | null
          nombre: string | null
        }
        Insert: {
          code?: string | null
          nombre?: string | null
        }
        Update: {
          code?: string | null
          nombre?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_area: { Args: never; Returns: string }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_is_admin_area: { Args: never; Returns: boolean }
      current_user_is_admin_pais: { Args: never; Returns: boolean }
      current_user_is_gerente_pais: { Args: never; Returns: boolean }
      current_user_is_regional_or_lider: { Args: never; Returns: boolean }
      current_user_pais: { Args: never; Returns: string }
      verificar_pin: {
        Args: { p_code: string; p_pin: string }
        Returns: boolean
      }
      verificar_pin_regional: { Args: { p_pin: string }; Returns: boolean }
      verificar_preautorizacion: { Args: { p_email: string }; Returns: boolean }
      vincular_preautorizacion: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
