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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      athlete_instructors: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_instructors_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_instructors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          birth_date: string | null
          category: string
          class: string
          code: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          instructor_id: string | null
          last_name: string
          medical_certificate_expiry: string | null
          notes: string | null
          phone: string | null
          responsabili: string[] | null
          updated_at: string
          gender: string | null
        }
        Insert: {
          birth_date?: string | null
          category: string
          class: string
          code: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          instructor_id?: string | null
          last_name: string
          medical_certificate_expiry?: string | null
          notes?: string | null
          phone?: string | null
          responsabili?: string[] | null
          updated_at?: string
          gender?: string | null
        }
        Update: {
          birth_date?: string | null
          category?: string
          class?: string
          code?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          instructor_id?: string | null
          last_name?: string
          medical_certificate_expiry?: string | null
          notes?: string | null
          phone?: string | null
          responsabili?: string[] | null
          updated_at?: string
          gender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_class_rules: {
        Row: {
          class: string
          competition_id: string
          created_at: string
          id: string
          is_allowed: boolean
          updated_at: string
        }
        Insert: {
          class: string
          competition_id: string
          created_at?: string
          id?: string
          is_allowed?: boolean
          updated_at?: string
        }
        Update: {
          class?: string
          competition_id?: string
          created_at?: string
          id?: string
          is_allowed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_class_rules_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_entries: {
        Row: {
          competition_id: string
          couple_id: string
          created_at: string
          disciplines: Database["public"]["Enums"]["dance_category"][]
          id: string
          is_paid: boolean
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          competition_id: string
          couple_id: string
          created_at?: string
          disciplines?: Database["public"]["Enums"]["dance_category"][]
          id?: string
          is_paid?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          competition_id?: string
          couple_id?: string
          created_at?: string
          disciplines?: Database["public"]["Enums"]["dance_category"][]
          id?: string
          is_paid?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_entries_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_entries_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_event_types: {
        Row: {
          allowed_classes: string[]
          competition_id: string
          created_at: string
          event_name: string
          id: string
          max_age: number | null
          min_age: number | null
          updated_at: string
        }
        Insert: {
          allowed_classes?: string[]
          competition_id: string
          created_at?: string
          event_name: string
          id?: string
          max_age?: number | null
          min_age?: number | null
          updated_at?: string
        }
        Update: {
          allowed_classes?: string[]
          competition_id?: string
          created_at?: string
          event_name?: string
          id?: string
          max_age?: number | null
          min_age?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_event_types_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string
          date: string
          description: string | null
          end_date: string | null
          id: string
          late_fee_deadline: string | null
          location: string | null
          name: string
          registration_deadline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          end_date?: string | null
          id?: string
          late_fee_deadline?: string | null
          location?: string | null
          name: string
          registration_deadline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          end_date?: string | null
          id?: string
          late_fee_deadline?: string | null
          location?: string | null
          name?: string
          registration_deadline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      couples: {
        Row: {
          athlete1_id: string
          athlete2_id: string
          category: string
          class: string
          created_at: string
          disciplines: Database["public"]["Enums"]["dance_category"][]
          id: string
          instructor_id: string | null
          is_active: boolean
          updated_at: string
        }
        Insert: {
          athlete1_id: string
          athlete2_id: string
          category: string
          class: string
          created_at?: string
          disciplines?: Database["public"]["Enums"]["dance_category"][]
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          athlete1_id?: string
          athlete2_id?: string
          category?: string
          class?: string
          created_at?: string
          disciplines?: Database["public"]["Enums"]["dance_category"][]
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couples_athlete1_id_fkey"
            columns: ["athlete1_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couples_athlete2_id_fkey"
            columns: ["athlete2_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couples_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_instructor_profile_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "instructor"
      dance_category: "standard" | "latino" | "combinata" | "show_dance"
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
      app_role: ["admin", "instructor"],
      dance_category: ["standard", "latino", "combinata", "show_dance"],
    },
  },
} as const
