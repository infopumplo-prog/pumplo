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
      app_feedback: {
        Row: {
          created_at: string | null
          experience_rating: number | null
          favorite_feature: string | null
          id: string
          improvements: string | null
          issues: string | null
          other_comments: string | null
          satisfaction: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          experience_rating?: number | null
          favorite_feature?: string | null
          id?: string
          improvements?: string | null
          issues?: string | null
          other_comments?: string | null
          satisfaction?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          experience_rating?: number | null
          favorite_feature?: string | null
          id?: string
          improvements?: string | null
          issues?: string | null
          other_comments?: string | null
          satisfaction?: string | null
          user_id?: string
        }
        Relationships: []
      }
      day_templates: {
        Row: {
          advanced_sets: number
          beginner_sets: number
          created_at: string | null
          day_letter: string
          day_name: string
          goal_id: string
          id: string
          intermediate_sets: number
          rep_max: number | null
          rep_min: number | null
          role_id: string
          slot_order: number
        }
        Insert: {
          advanced_sets?: number
          beginner_sets?: number
          created_at?: string | null
          day_letter: string
          day_name: string
          goal_id: string
          id?: string
          intermediate_sets?: number
          rep_max?: number | null
          rep_min?: number | null
          role_id: string
          slot_order: number
        }
        Update: {
          advanced_sets?: number
          beginner_sets?: number
          created_at?: string | null
          day_letter?: string
          day_name?: string
          goal_id?: string
          id?: string
          intermediate_sets?: number
          rep_max?: number | null
          rep_min?: number | null
          role_id?: string
          slot_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "day_templates_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "training_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_templates_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "training_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_skip_feedback: {
        Row: {
          created_at: string | null
          day_letter: string | null
          exercise_id: string | null
          exercise_name: string
          gym_id: string | null
          id: string
          other_reason: string | null
          plan_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_letter?: string | null
          exercise_id?: string | null
          exercise_name: string
          gym_id?: string | null
          id?: string
          other_reason?: string | null
          plan_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_letter?: string | null
          exercise_id?: string | null
          exercise_name?: string
          gym_id?: string | null
          id?: string
          other_reason?: string | null
          plan_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_skip_feedback_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_skip_feedback_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_skip_feedback_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "public_gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_skip_feedback_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "user_workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          allowed_phase: string | null
          category: string
          created_at: string
          difficulty: number
          equipment_type: string | null
          exercise_with_weights: boolean | null
          id: string
          machine_id: string | null
          name: string
          primary_muscles: string[]
          primary_role: string | null
          secondary_muscles: string[]
          updated_at: string
          video_path: string | null
        }
        Insert: {
          allowed_phase?: string | null
          category: string
          created_at?: string
          difficulty?: number
          equipment_type?: string | null
          exercise_with_weights?: boolean | null
          id?: string
          machine_id?: string | null
          name: string
          primary_muscles?: string[]
          primary_role?: string | null
          secondary_muscles?: string[]
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          allowed_phase?: string | null
          category?: string
          created_at?: string
          difficulty?: number
          equipment_type?: string | null
          exercise_with_weights?: boolean | null
          id?: string
          machine_id?: string | null
          name?: string
          primary_muscles?: string[]
          primary_role?: string | null
          secondary_muscles?: string[]
          updated_at?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_primary_role_fkey"
            columns: ["primary_role"]
            isOneToOne: false
            referencedRelation: "training_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_machines: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          machine_id: string
          max_weight_kg: number | null
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          machine_id: string
          max_weight_kg?: number | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          machine_id?: string
          max_weight_kg?: number | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_machines_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_machines_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "public_gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          address: string | null
          cover_photo_url: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          latitude: number
          logo_url: string | null
          longitude: number
          name: string
          opening_hours: Json
          owner_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          latitude: number
          logo_url?: string | null
          longitude: number
          name: string
          opening_hours?: Json
          owner_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          latitude?: number
          logo_url?: string | null
          longitude?: number
          name?: string
          opening_hours?: Json
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_muscles: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          muscle: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          muscle: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          muscle?: string
          role_id?: string
        }
        Relationships: []
      }
      training_goals: {
        Row: {
          created_at: string | null
          day_count: number
          description: string | null
          duration_weeks: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          day_count: number
          description?: string | null
          duration_weeks?: number | null
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          day_count?: number
          description?: string | null
          duration_weeks?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      training_roles: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          age: number | null
          created_at: string
          current_day_index: number | null
          current_step: number | null
          current_streak: number | null
          equipment_preference: string | null
          first_name: string | null
          gender: string | null
          gym_license_count: number | null
          height_cm: number | null
          id: string
          injuries: string[] | null
          last_name: string | null
          max_streak: number | null
          motivations: string[] | null
          notification_closing_soon: boolean | null
          notification_missed_workout: boolean | null
          notification_morning_reminder: boolean | null
          notification_onboarding_shown: boolean | null
          onboarding_completed: boolean | null
          preferred_time: string | null
          primary_goal: string | null
          push_subscription: Json | null
          secondary_goals: string[] | null
          selected_gym_id: string | null
          streak_updated_at: string | null
          training_days: string[] | null
          training_duration_minutes: number | null
          training_split: string | null
          updated_at: string
          user_id: string
          user_level: string | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          current_day_index?: number | null
          current_step?: number | null
          current_streak?: number | null
          equipment_preference?: string | null
          first_name?: string | null
          gender?: string | null
          gym_license_count?: number | null
          height_cm?: number | null
          id?: string
          injuries?: string[] | null
          last_name?: string | null
          max_streak?: number | null
          motivations?: string[] | null
          notification_closing_soon?: boolean | null
          notification_missed_workout?: boolean | null
          notification_morning_reminder?: boolean | null
          notification_onboarding_shown?: boolean | null
          onboarding_completed?: boolean | null
          preferred_time?: string | null
          primary_goal?: string | null
          push_subscription?: Json | null
          secondary_goals?: string[] | null
          selected_gym_id?: string | null
          streak_updated_at?: string | null
          training_days?: string[] | null
          training_duration_minutes?: number | null
          training_split?: string | null
          updated_at?: string
          user_id: string
          user_level?: string | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          current_day_index?: number | null
          current_step?: number | null
          current_streak?: number | null
          equipment_preference?: string | null
          first_name?: string | null
          gender?: string | null
          gym_license_count?: number | null
          height_cm?: number | null
          id?: string
          injuries?: string[] | null
          last_name?: string | null
          max_streak?: number | null
          motivations?: string[] | null
          notification_closing_soon?: boolean | null
          notification_missed_workout?: boolean | null
          notification_morning_reminder?: boolean | null
          notification_onboarding_shown?: boolean | null
          onboarding_completed?: boolean | null
          preferred_time?: string | null
          primary_goal?: string | null
          push_subscription?: Json | null
          secondary_goals?: string[] | null
          selected_gym_id?: string | null
          streak_updated_at?: string | null
          training_days?: string[] | null
          training_duration_minutes?: number | null
          training_split?: string | null
          updated_at?: string
          user_id?: string
          user_level?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_selected_gym_id_fkey"
            columns: ["selected_gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_selected_gym_id_fkey"
            columns: ["selected_gym_id"]
            isOneToOne: false
            referencedRelation: "public_gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_workout_exercises: {
        Row: {
          created_at: string | null
          day_letter: string
          exercise_id: string | null
          fallback_reason: string | null
          id: string
          is_fallback: boolean | null
          plan_id: string
          rep_max: number | null
          rep_min: number | null
          role_id: string
          sets: number
          slot_order: number
        }
        Insert: {
          created_at?: string | null
          day_letter: string
          exercise_id?: string | null
          fallback_reason?: string | null
          id?: string
          is_fallback?: boolean | null
          plan_id: string
          rep_max?: number | null
          rep_min?: number | null
          role_id: string
          sets: number
          slot_order: number
        }
        Update: {
          created_at?: string | null
          day_letter?: string
          exercise_id?: string | null
          fallback_reason?: string | null
          id?: string
          is_fallback?: boolean | null
          plan_id?: string
          rep_max?: number | null
          rep_min?: number | null
          role_id?: string
          sets?: number
          slot_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_workout_exercises_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "user_workout_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_workout_exercises_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "training_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_workout_plans: {
        Row: {
          created_at: string | null
          current_week: number | null
          goal_id: string
          gym_id: string | null
          id: string
          is_active: boolean | null
          started_at: string | null
          training_days: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_week?: number | null
          goal_id: string
          gym_id?: string | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          training_days?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_week?: number | null
          goal_id?: string
          gym_id?: string | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          training_days?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_workout_plans_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "training_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_workout_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_workout_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "public_gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_session_sets: {
        Row: {
          completed: boolean
          created_at: string
          exercise_id: string | null
          exercise_name: string
          id: string
          reps: number | null
          session_id: string
          set_number: number
          weight_kg: number | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          exercise_id?: string | null
          exercise_name: string
          id?: string
          reps?: number | null
          session_id: string
          set_number: number
          weight_kg?: number | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          exercise_id?: string | null
          exercise_name?: string
          id?: string
          reps?: number | null
          session_id?: string
          set_number?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_session_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_session_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          day_letter: string
          duration_seconds: number | null
          goal_id: string
          gym_id: string | null
          id: string
          is_bonus: boolean
          plan_id: string | null
          started_at: string
          total_reps: number | null
          total_sets: number | null
          total_weight_kg: number | null
          user_id: string
          week_number: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day_letter: string
          duration_seconds?: number | null
          goal_id: string
          gym_id?: string | null
          id?: string
          is_bonus?: boolean
          plan_id?: string | null
          started_at?: string
          total_reps?: number | null
          total_sets?: number | null
          total_weight_kg?: number | null
          user_id: string
          week_number?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day_letter?: string
          duration_seconds?: number | null
          goal_id?: string
          gym_id?: string | null
          id?: string
          is_bonus?: boolean
          plan_id?: string | null
          started_at?: string
          total_reps?: number | null
          total_sets?: number | null
          total_weight_kg?: number | null
          user_id?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "public_gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "user_workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_gyms: {
        Row: {
          address: string | null
          cover_photo_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_published: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string | null
          opening_hours: Json | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_published?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
          opening_hours?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_published?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
          opening_hours?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "business" | "admin"
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
      app_role: ["user", "business", "admin"],
    },
  },
} as const
