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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      books: {
        Row: {
          author: string | null
          comment: string | null
          created_at: string
          id: string
          is_public: boolean
          photo_path: string | null
          rating: number | null
          status: string
          title: string
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          author?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          photo_path?: string | null
          rating?: number | null
          status?: string
          title: string
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          author?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          photo_path?: string | null
          rating?: number | null
          status?: string
          title?: string
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      experience_photos: {
        Row: {
          created_at: string
          experience_id: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          experience_id: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          experience_id?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_photos_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_scores: {
        Row: {
          criterion: string
          experience_id: string
          id: string
          score: number
        }
        Insert: {
          criterion: string
          experience_id: string
          id?: string
          score: number
        }
        Update: {
          criterion?: string
          experience_id?: string
          id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "experience_scores_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          category: string
          comment: string | null
          created_at: string
          id: string
          is_public: boolean
          place_id: string
          rating: number
          stall_id: string | null
          user_id: string
          visited_at: string
          would_return: boolean
        }
        Insert: {
          category: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          place_id: string
          rating: number
          stall_id?: string | null
          user_id: string
          visited_at?: string
          would_return?: boolean
        }
        Update: {
          category?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          place_id?: string
          rating?: number
          stall_id?: string | null
          user_id?: string
          visited_at?: string
          would_return?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "experiences_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["google_place_id"]
          },
          {
            foreignKeyName: "experiences_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "fair_stalls"
            referencedColumns: ["id"]
          },
        ]
      }
      fair_stalls: {
        Row: {
          created_at: string
          created_by: string
          emoji: string
          id: string
          kind: string
          name: string
          place_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          emoji?: string
          id?: string
          kind?: string
          name: string
          place_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          emoji?: string
          id?: string
          kind?: string
          name?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fair_stalls_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["google_place_id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category: string | null
          google_place_id: string
          lat: number | null
          lng: number | null
          name: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          google_place_id: string
          lat?: number | null
          lng?: number | null
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          google_place_id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          created_at: string
          list: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          list: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          list?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["google_place_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      place_experience_stats: {
        Args: { _place_ids: string[] }
        Returns: {
          avg_rating: number
          experience_count: number
          place_id: string
        }[]
      }
      stall_experience_stats: {
        Args: { _stall_ids: string[] }
        Returns: {
          avg_rating: number
          experience_count: number
          stall_id: string
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
