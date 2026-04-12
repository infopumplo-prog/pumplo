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
      custom_plan_days: {
        Row: {
          id: string
          plan_id: string
          day_number: number
          name: string | null
        }
        Insert: {
          id?: string
          plan_id: string
          day_number: number
          name?: string | null
        }
        Update: {
          id?: string
          plan_id?: string
          day_number?: number
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "custom_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_plan_exercises: {
        Row: {
          id: string
          day_id: string
          exercise_id: string
          sets: number
          reps: number
          weight_kg: number | null
          order_index: number
        }
        Insert: {
          id?: string
          day_id: string
          exercise_id: string
          sets?: number
          reps?: number
          weight_kg?: number | null
          order_index?: number
        }
        Update: {
          id?: string
          day_id?: string
          exercise_id?: string
          sets?: number
          reps?: number
          weight_kg?: number | null
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_plan_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "custom_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
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
          slot_category: string | null
          rir_min: number | null
          rir_max: number | null
          notes: string | null
          split_type: string | null
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
          slot_category?: string | null
          rir_min?: number | null
          rir_max?: number | null
          notes?: string | null
          split_type?: string | null
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
          slot_category?: string | null
          rir_min?: number | null
          rir_max?: number | null
          notes?: string | null
          split_type?: string | null
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
          banned_injuries: string[] | null
          body_region: string | null
          category: string
          common_mistakes: string | null
          created_at: string
          description: string | null
          difficulty: number
          equipment_type: string | null
          exercise_with_weights: boolean | null
          id: string
          is_compound: boolean | null
          machine_id: string | null
          name: string
          primary_muscles: string[]
          primary_role: string | null
          required_bench_config: string | null
          secondary_machine_id: string | null
          secondary_muscles: string[]
          setup_instructions: string | null
          slot_type: string | null
          stability_rating: number | null
          tips: string | null
          updated_at: string
          video_path: string | null
        }
        Insert: {
          allowed_phase?: string | null
          banned_injuries?: string[] | null
          body_region?: string | null
          category: string
          common_mistakes?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          equipment_type?: string | null
          exercise_with_weights?: boolean | null
          id?: string
          is_compound?: boolean | null
          machine_id?: string | null
          name: string
          primary_muscles?: string[]
          primary_role?: string | null
          required_bench_config?: string | null
          secondary_machine_id?: string | null
          secondary_muscles?: string[]
          setup_instructions?: string | null
          slot_type?: string | null
          stability_rating?: number | null
          tips?: string | null
          updated_at?: string
          video_path?: string | null
        }
        Update: {
          allowed_phase?: string | null
          banned_injuries?: string[] | null
          body_region?: string | null
          category?: string
          common_mistakes?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number
          equipment_type?: string | null
          exercise_with_weights?: boolean | null
          id?: string
          is_compound?: boolean | null
          machine_id?: string | null
          name?: string
          primary_muscles?: string[]
          primary_role?: string | null
          required_bench_config?: string | null
          secondary_machine_id?: string | null
          secondary_muscles?: string[]
          setup_instructions?: string | null
          slot_type?: string | null
          stability_rating?: number | null
          tips?: string | null
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
          {
            foreignKeyName: "exercises_secondary_machine_id_fkey"
            columns: ["secondary_machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_machines: {
        Row: {
          bench_configs: string[] | null
          created_at: string
          gym_id: string
          id: string
          machine_id: string
          max_weight_kg: number | null
          quantity: number
          short_code: string
          updated_at: string
        }
        Insert: {
          bench_configs?: string[] | null
          created_at?: string
          gym_id: string
          id?: string
          machine_id: string
          max_weight_kg?: number | null
          quantity?: number
          short_code?: string
          updated_at?: string
        }
        Update: {
          bench_configs?: string[] | null
          created_at?: string
          gym_id?: string
          id?: string
          machine_id?: string
          max_weight_kg?: number | null
          quantity?: number
          short_code?: string
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
      gym_photos: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          photo_url: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          photo_url: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          photo_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_photos_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_photos_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "public_gyms"
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
          is_verified: boolean | null
          latitude: number
          logo_url: string | null
          longitude: number
          name: string
          opening_hours: Json
          owner_id: string
          pricing: Json | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_verified?: boolean | null
          latitude: number
          logo_url?: string | null
          longitude: number
          name: string
          opening_hours?: Json
          owner_id: string
          pricing?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_verified?: boolean | null
          latitude?: number
          logo_url?: string | null
          longitude?: number
          name?: string
          opening_hours?: Json
          owner_id?: string
          pricing?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string
          description: string | null
          equipment_category: string | null
          id: string
          image_url: string | null
          is_cardio: boolean | null
          name: string
          requires_bench_config: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          equipment_category?: string | null
          id?: string
          image_url?: string | null
          is_cardio?: boolean | null
          name: string
          requires_bench_config?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          equipment_category?: string | null
          id?: string
          image_url?: string | null
          is_cardio?: boolean | null
          name?: string
          requires_bench_config?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          date_key: string
          id: string
          notification_type: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          date_key: string
          id?: string
          notification_type: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          date_key?: string
          id?: string
          notification_type?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_aliases: {
        Row: {
          alias_for: string
          created_at: string | null
          id: string
          priority: number | null
        }
        Insert: {
          alias_for: string
          created_at?: string | null
          id: string
          priority?: number | null
        }
        Update: {
          alias_for?: string
          created_at?: string | null
          id?: string
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "role_aliases_alias_for_fkey"
            columns: ["alias_for"]
            isOneToOne: false
            referencedRelation: "training_roles"
            referencedColumns: ["id"]
          },
        ]
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
          allowed_equipment_categories: string[] | null
          banned_injury_tags: string[] | null
          category: string
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          has_bodyweight_variant: boolean | null
          id: string
          name: string
          phase_type: string | null
        }
        Insert: {
          allowed_equipment_categories?: string[] | null
          banned_injury_tags?: string[] | null
          category: string
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          has_bodyweight_variant?: boolean | null
          id: string
          name: string
          phase_type?: string | null
        }
        Update: {
          allowed_equipment_categories?: string[] | null
          banned_injury_tags?: string[] | null
          category?: string
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          has_bodyweight_variant?: boolean | null
          id?: string
          name?: string
          phase_type?: string | null
        }
        Relationships: []
      }
      user_exercise_history: {
        Row: {
          day_letter: string | null
          exercise_id: string | null
          id: string
          plan_id: string | null
          role_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          day_letter?: string | null
          exercise_id?: string | null
          id?: string
          plan_id?: string | null
          role_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          day_letter?: string | null
          exercise_id?: string | null
          id?: string
          plan_id?: string | null
          role_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_history_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "user_workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          admin_notes: string | null
          app_version: string | null
          can_contact: boolean | null
          contact_email: string | null
          created_at: string | null
          current_route: string | null
          day_index: number | null
          day_letter: string | null
          error_code: string | null
          error_message: string | null
          exercise_id: string | null
          feedback_type: Database["public"]["Enums"]["feedback_type"]
          gym_id: string | null
          id: string
          last_action: string | null
          locale: string | null
          message: string | null
          plan_id: string | null
          platform: string | null
          responses: Json | null
          screenshot_url: string | null
          status: Database["public"]["Enums"]["feedback_status"] | null
          timezone: string | null
          user_id: string
          week_index: number | null
          workout_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          app_version?: string | null
          can_contact?: boolean | null
          contact_email?: string | null
          created_at?: string | null
          current_route?: string | null
          day_index?: number | null
          day_letter?: string | null
          error_code?: string | null
          error_message?: string | null
          exercise_id?: string | null
          feedback_type: Database["public"]["Enums"]["feedback_type"]
          gym_id?: string | null
          id?: string
          last_action?: string | null
          locale?: string | null
          message?: string | null
          plan_id?: string | null
          platform?: string | null
          responses?: Json | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["feedback_status"] | null
          timezone?: string | null
          user_id: string
          week_index?: number | null
          workout_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          app_version?: string | null
          can_contact?: boolean | null
          contact_email?: string | null
          created_at?: string | null
          current_route?: string | null
          day_index?: number | null
          day_letter?: string | null
          error_code?: string | null
          error_message?: string | null
          exercise_id?: string | null
          feedback_type?: Database["public"]["Enums"]["feedback_type"]
          gym_id?: string | null
          id?: string
          last_action?: string | null
          locale?: string | null
          message?: string | null
          plan_id?: string | null
          platform?: string | null
          responses?: Json | null
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["feedback_status"] | null
          timezone?: string | null
          user_id?: string
          week_index?: number | null
          workout_id?: string | null
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
          selection_score: number | null
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
          selection_score?: number | null
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
          selection_score?: number | null
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
          generator_version: string | null
          goal_id: string
          gym_id: string | null
          id: string
          inputs_snapshot_json: Json | null
          is_active: boolean | null
          methodology_version: string | null
          needs_regeneration: boolean | null
          selection_seed: string | null
          split_type: string | null
          started_at: string | null
          training_days: string[] | null
          updated_at: string | null
          user_id: string
          validation_report_json: Json | null
        }
        Insert: {
          created_at?: string | null
          current_week?: number | null
          generator_version?: string | null
          goal_id: string
          gym_id?: string | null
          id?: string
          inputs_snapshot_json?: Json | null
          is_active?: boolean | null
          methodology_version?: string | null
          needs_regeneration?: boolean | null
          selection_seed?: string | null
          split_type?: string | null
          started_at?: string | null
          training_days?: string[] | null
          updated_at?: string | null
          user_id: string
          validation_report_json?: Json | null
        }
        Update: {
          created_at?: string | null
          current_week?: number | null
          generator_version?: string | null
          goal_id?: string
          gym_id?: string | null
          id?: string
          inputs_snapshot_json?: Json | null
          is_active?: boolean | null
          methodology_version?: string | null
          needs_regeneration?: boolean | null
          selection_seed?: string | null
          split_type?: string | null
          started_at?: string | null
          training_days?: string[] | null
          updated_at?: string | null
          user_id?: string
          validation_report_json?: Json | null
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
          is_featured: boolean | null
          is_published: boolean | null
          is_verified: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string | null
          opening_hours: Json | null
          pricing: Json | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_featured?: boolean | null
          is_published?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
          opening_hours?: Json | null
          pricing?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_featured?: boolean | null
          is_published?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
          opening_hours?: Json | null
          pricing?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_notification_logs: { Args: never; Returns: undefined }
      generate_workout_plan_atomic:
        | {
            Args: {
              p_exercises: Json
              p_generator_version: string
              p_goal_id: string
              p_gym_id: string
              p_inputs_snapshot: Json
              p_methodology_version: string
              p_selection_seed: string
              p_training_days: string[]
              p_user_id: string
              p_validation_report?: Json
            }
            Returns: string
          }
        | {
            Args: {
              p_exercises: Json
              p_generator_version: string
              p_goal_id: string
              p_gym_id: string
              p_inputs_snapshot: Json
              p_methodology_version: string
              p_selection_seed: string
              p_split_type?: string
              p_training_days: string[]
              p_user_id: string
              p_validation_report?: Json
            }
            Returns: string
          }
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
      feedback_status: "new" | "in_progress" | "fixed" | "wont_fix"
      feedback_type:
        | "training_exercises"
        | "bug_error"
        | "missing_feature"
        | "confusion"
        | "other"
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
      feedback_status: ["new", "in_progress", "fixed", "wont_fix"],
      feedback_type: [
        "training_exercises",
        "bug_error",
        "missing_feature",
        "confusion",
        "other",
      ],
    },
  },
} as const
