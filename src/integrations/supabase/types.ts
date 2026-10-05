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
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          request_id: string
          sender: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          request_id: string
          sender: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          from_presence_started: string
          from_user: string
          id: string
          place_id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_presence_started: string
          from_user: string
          id?: string
          place_id: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_presence_started?: string
          from_user?: string
          id?: string
          place_id?: string
          status?: string
          to_user?: string
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
      place_presence: {
        Row: {
          expires_at: string
          interests: string[]
          mode: string
          place_id: string
          started_at: string
          status: string | null
          user_id: string
          visible: boolean
        }
        Insert: {
          expires_at?: string
          interests?: string[]
          mode?: string
          place_id: string
          started_at?: string
          status?: string | null
          user_id: string
          visible?: boolean
        }
        Update: {
          expires_at?: string
          interests?: string[]
          mode?: string
          place_id?: string
          started_at?: string
          status?: string | null
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "place_presence_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["google_place_id"]
          },
        ]
      }
      place_situations: {
        Row: {
          created_at: string
          expires_at: string
          hidden: boolean
          id: string
          kind: string
          place_id: string
          situations: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          hidden?: boolean
          id?: string
          kind: string
          place_id: string
          situations?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          hidden?: boolean
          id?: string
          kind?: string
          place_id?: string
          situations?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_situations_place_id_fkey"
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
          photo_name: string | null
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
          photo_name?: string | null
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
          photo_name?: string | null
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
      rate_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
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
      situation_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter: string
          situation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string
          reporter: string
          situation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter?: string
          situation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "situation_reports_situation_id_fkey"
            columns: ["situation_id"]
            isOneToOne: false
            referencedRelation: "place_situations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked: string
          blocker: string
          created_at: string
        }
        Insert: {
          blocked: string
          blocker: string
          created_at?: string
        }
        Update: {
          blocked?: string
          blocker?: string
          created_at?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          id: string
          place_id: string | null
          reason: string
          reported: string
          reporter: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id?: string | null
          reason: string
          reported: string
          reporter: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string | null
          reason?: string
          reported?: string
          reporter?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      chat_messages_for: {
        Args: { _request_id: string }
        Returns: {
          body: string
          created_at: string
          id: string
          mine: boolean
        }[]
      }
      cleanup_presence: { Args: never; Returns: undefined }
      end_presence: { Args: never; Returns: undefined }
      hit_rate_limit: {
        Args: {
          _bucket: string
          _max: number
          _user: string
          _window_seconds: number
        }
        Returns: boolean
      }
      my_connections: {
        Args: { _place_id: string }
        Returns: {
          id: string
          incoming: boolean
          other_id: string
          other_name: string
          status: string
        }[]
      }
      place_experience_stats: {
        Args: { _place_ids: string[] }
        Returns: {
          avg_rating: number
          experience_count: number
          place_id: string
        }[]
      }
      place_people: {
        Args: { _place_id: string }
        Returns: {
          first_name: string
          is_me: boolean
          status: string
        }[]
      }
      place_people_v2: {
        Args: { _place_id: string }
        Returns: {
          first_name: string
          interests: string[]
          is_me: boolean
          mode: string
          user_id: string
        }[]
      }
      place_situation_now: {
        Args: { _place_ids: string[] }
        Returns: {
          expires_at: string
          people_here: number
          place_id: string
          situation_id: string
          situations: string[]
          updated_at: string
        }[]
      }
      respond_connection: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      send_chat_message: {
        Args: { _body: string; _request_id: string }
        Returns: undefined
      }
      send_connection: {
        Args: { _place_id: string; _to: string }
        Returns: undefined
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
