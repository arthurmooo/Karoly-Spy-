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
      activities: {
        Row: {
          activity_name: string | null
          athlete_id: string | null
          avg_hr: number | null
          avg_power: number | null
          created_at: string | null
          decoupling_index: number | null
          distance_m: number | null
          drift_pahr_percent: number | null
          durability_index: number | null
          duration_sec: number | null
          elevation_gain: number | null
          energy_kj: number | null
          fit_file_hash: string | null
          fit_file_path: string | null
          humidity_avg: number | null
          id: string
          int_index: number | null
          interval_detection_source: string | null
          interval_hr_last: number | null
          interval_hr_mean: number | null
          interval_pace_last: number | null
          interval_pace_mean: number | null
          interval_power_last: number | null
          interval_power_mean: number | null
          interval_respect_score: number | null
          load_index: number | null
          manual_activity_name: string | null
          manual_interval_block_1_hr_last: number | null
          manual_interval_block_1_hr_mean: number | null
          manual_interval_block_1_pace_last: number | null
          manual_interval_block_1_pace_mean: number | null
          manual_interval_block_1_power_last: number | null
          manual_interval_block_1_power_mean: number | null
          manual_interval_block_2_hr_last: number | null
          manual_interval_block_2_hr_mean: number | null
          manual_interval_block_2_pace_last: number | null
          manual_interval_block_2_pace_mean: number | null
          manual_interval_block_2_power_last: number | null
          manual_interval_block_2_power_mean: number | null
          manual_interval_hr_last: number | null
          manual_interval_hr_mean: number | null
          manual_interval_pace_last: number | null
          manual_interval_pace_mean: number | null
          manual_interval_power_last: number | null
          manual_interval_power_mean: number | null
          mec: number | null
          missing_rpe_flag: boolean | null
          nolio_id: string | null
          normalized_power: number | null
          rpe: number | null
          segmented_metrics: Json | null
          session_date: string
          session_group_id: string | null
          session_group_order: number | null
          session_group_role: string | null
          session_group_type: string | null
          source_json: Json | null
          source_sport: string | null
          sport_type: string
          temp_avg: number | null
          tss: number | null
          updated_at: string | null
          weather_source: string | null
          work_type: string | null
        }
        Insert: {
          activity_name?: string | null
          athlete_id?: string | null
          avg_hr?: number | null
          avg_power?: number | null
          created_at?: string | null
          decoupling_index?: number | null
          distance_m?: number | null
          drift_pahr_percent?: number | null
          durability_index?: number | null
          duration_sec?: number | null
          elevation_gain?: number | null
          energy_kj?: number | null
          fit_file_hash?: string | null
          fit_file_path?: string | null
          humidity_avg?: number | null
          id?: string
          int_index?: number | null
          interval_detection_source?: string | null
          interval_hr_last?: number | null
          interval_hr_mean?: number | null
          interval_pace_last?: number | null
          interval_pace_mean?: number | null
          interval_power_last?: number | null
          interval_power_mean?: number | null
          interval_respect_score?: number | null
          load_index?: number | null
          manual_activity_name?: string | null
          manual_interval_block_1_hr_last?: number | null
          manual_interval_block_1_hr_mean?: number | null
          manual_interval_block_1_pace_last?: number | null
          manual_interval_block_1_pace_mean?: number | null
          manual_interval_block_1_power_last?: number | null
          manual_interval_block_1_power_mean?: number | null
          manual_interval_block_2_hr_last?: number | null
          manual_interval_block_2_hr_mean?: number | null
          manual_interval_block_2_pace_last?: number | null
          manual_interval_block_2_pace_mean?: number | null
          manual_interval_block_2_power_last?: number | null
          manual_interval_block_2_power_mean?: number | null
          manual_interval_hr_last?: number | null
          manual_interval_hr_mean?: number | null
          manual_interval_pace_last?: number | null
          manual_interval_pace_mean?: number | null
          manual_interval_power_last?: number | null
          manual_interval_power_mean?: number | null
          mec?: number | null
          missing_rpe_flag?: boolean | null
          nolio_id?: string | null
          normalized_power?: number | null
          rpe?: number | null
          segmented_metrics?: Json | null
          session_date: string
          session_group_id?: string | null
          session_group_order?: number | null
          session_group_role?: string | null
          session_group_type?: string | null
          source_json?: Json | null
          source_sport?: string | null
          sport_type: string
          temp_avg?: number | null
          tss?: number | null
          updated_at?: string | null
          weather_source?: string | null
          work_type?: string | null
        }
        Update: {
          activity_name?: string | null
          athlete_id?: string | null
          avg_hr?: number | null
          avg_power?: number | null
          created_at?: string | null
          decoupling_index?: number | null
          distance_m?: number | null
          drift_pahr_percent?: number | null
          durability_index?: number | null
          duration_sec?: number | null
          elevation_gain?: number | null
          energy_kj?: number | null
          fit_file_hash?: string | null
          fit_file_path?: string | null
          humidity_avg?: number | null
          id?: string
          int_index?: number | null
          interval_detection_source?: string | null
          interval_hr_last?: number | null
          interval_hr_mean?: number | null
          interval_pace_last?: number | null
          interval_pace_mean?: number | null
          interval_power_last?: number | null
          interval_power_mean?: number | null
          interval_respect_score?: number | null
          load_index?: number | null
          manual_activity_name?: string | null
          manual_interval_block_1_hr_last?: number | null
          manual_interval_block_1_hr_mean?: number | null
          manual_interval_block_1_pace_last?: number | null
          manual_interval_block_1_pace_mean?: number | null
          manual_interval_block_1_power_last?: number | null
          manual_interval_block_1_power_mean?: number | null
          manual_interval_block_2_hr_last?: number | null
          manual_interval_block_2_hr_mean?: number | null
          manual_interval_block_2_pace_last?: number | null
          manual_interval_block_2_pace_mean?: number | null
          manual_interval_block_2_power_last?: number | null
          manual_interval_block_2_power_mean?: number | null
          manual_interval_hr_last?: number | null
          manual_interval_hr_mean?: number | null
          manual_interval_pace_last?: number | null
          manual_interval_pace_mean?: number | null
          manual_interval_power_last?: number | null
          manual_interval_power_mean?: number | null
          mec?: number | null
          missing_rpe_flag?: boolean | null
          nolio_id?: string | null
          normalized_power?: number | null
          rpe?: number | null
          segmented_metrics?: Json | null
          session_date?: string
          session_group_id?: string | null
          session_group_order?: number | null
          session_group_role?: string | null
          session_group_type?: string | null
          source_json?: Json | null
          source_sport?: string | null
          sport_type?: string
          temp_avg?: number | null
          tss?: number | null
          updated_at?: string | null
          weather_source?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_intervals: {
        Row: {
          activity_id: string
          avg_cadence: number | null
          avg_hr: number | null
          avg_power: number | null
          avg_speed: number | null
          created_at: string | null
          decoupling: number | null
          detection_source: string
          duration: number
          end_time: number
          id: string
          pa_hr_ratio: number | null
          respect_score: number | null
          start_time: number
          type: string
        }
        Insert: {
          activity_id: string
          avg_cadence?: number | null
          avg_hr?: number | null
          avg_power?: number | null
          avg_speed?: number | null
          created_at?: string | null
          decoupling?: number | null
          detection_source: string
          duration: number
          end_time: number
          id?: string
          pa_hr_ratio?: number | null
          respect_score?: number | null
          start_time: number
          type: string
        }
        Update: {
          activity_id?: string
          avg_cadence?: number | null
          avg_hr?: number | null
          avg_power?: number | null
          avg_speed?: number | null
          created_at?: string | null
          decoupling?: number | null
          detection_source?: string
          duration?: number
          end_time?: number
          id?: string
          pa_hr_ratio?: number | null
          respect_score?: number | null
          start_time?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_intervals_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_intervals_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "view_athlete_monitoring_karo"
            referencedColumns: ["activity_id"]
          },
        ]
      }
      app_secrets: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      athlete_devices: {
        Row: {
          athlete_id: string | null
          created_at: string | null
          device_name: string | null
          id: string
          serial_number: string
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string | null
          device_name?: string | null
          id?: string
          serial_number: string
        }
        Update: {
          athlete_id?: string | null
          created_at?: string | null
          device_name?: string | null
          id?: string
          serial_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_devices_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          created_at: string | null
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          nolio_id: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          first_name: string
          id?: string
          is_active?: boolean | null
          last_name: string
          nolio_id?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          nolio_id?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_readiness: {
        Row: {
          athlete_id: string
          created_at: string | null
          date: string
          resting_hr: number | null
          resting_hr_30d_avg: number | null
          rmssd: number | null
          rmssd_30d_avg: number | null
          sleep_duration: number | null
          sleep_score: number | null
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          date: string
          resting_hr?: number | null
          resting_hr_30d_avg?: number | null
          rmssd?: number | null
          rmssd_30d_avg?: number | null
          sleep_duration?: number | null
          sleep_score?: number | null
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          date?: string
          resting_hr?: number | null
          resting_hr_30d_avg?: number | null
          rmssd?: number | null
          rmssd_30d_avg?: number | null
          sleep_duration?: number | null
          sleep_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_readiness_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_profiles: {
        Row: {
          athlete_id: string | null
          athlete_name: string | null
          cp_cs: number | null
          cp_ht: number | null
          cp_montee: number | null
          created_at: string | null
          id: string
          lt1_hr: number | null
          lt1_power_pace: number | null
          lt2_hr: number | null
          lt2_power_pace: number | null
          sport: string
          valid_from: string
          valid_to: string | null
          vma: number | null
          weight: number | null
        }
        Insert: {
          athlete_id?: string | null
          athlete_name?: string | null
          cp_cs?: number | null
          cp_ht?: number | null
          cp_montee?: number | null
          created_at?: string | null
          id?: string
          lt1_hr?: number | null
          lt1_power_pace?: number | null
          lt2_hr?: number | null
          lt2_power_pace?: number | null
          sport: string
          valid_from: string
          valid_to?: string | null
          vma?: number | null
          weight?: number | null
        }
        Update: {
          athlete_id?: string | null
          athlete_name?: string | null
          cp_cs?: number | null
          cp_ht?: number | null
          cp_montee?: number | null
          created_at?: string | null
          id?: string
          lt1_hr?: number | null
          lt1_power_pace?: number | null
          lt2_hr?: number | null
          lt2_power_pace?: number | null
          sport?: string
          valid_from?: string
          valid_to?: string | null
          vma?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physio_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_config: {
        Row: {
          category: string
          description: string | null
          key: string
          updated_at: string | null
          value: number
        }
        Insert: {
          category: string
          description?: string | null
          key: string
          updated_at?: string | null
          value: number
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error_message: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          provider: string | null
          received_at: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          provider?: string | null
          received_at?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          provider?: string | null
          received_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      view_athlete_history: {
        Row: {
          allure_last: number | null
          allure_moy: number | null
          athlete: string | null
          date: string | null
          decouplage_relatif: number | null
          duree_min: number | null
          hrmean_last: number | null
          hrmean_w: number | null
          hum: number | null
          km: number | null
          pmoy_w: number | null
          puissance_last: number | null
          ratio_efficacite: number | null
          sport: string | null
          temp: number | null
          torque_nm: number | null
        }
        Relationships: []
      }
      view_athlete_monitoring_karo: {
        Row: {
          activity_id: string | null
          "Allure (Last)": string | null
          "Allure Moy": string | null
          athlete: string | null
          Date: string | null
          "Découplage": number | null
          "Durée": string | null
          "Hr Séance": number | null
          "HRmean (Last)": number | null
          HRmeanW: number | null
          "Intensité Séance": string | null
          interval_block_1_hr_last: number | null
          interval_block_1_hr_mean: number | null
          interval_block_1_pace_last: number | null
          interval_block_1_pace_last_fmt: string | null
          interval_block_1_pace_mean: number | null
          interval_block_1_pace_mean_fmt: string | null
          interval_block_1_power_last: number | null
          interval_block_1_power_mean: number | null
          interval_block_2_hr_last: number | null
          interval_block_2_hr_mean: number | null
          interval_block_2_pace_last: number | null
          interval_block_2_pace_last_fmt: string | null
          interval_block_2_pace_mean: number | null
          interval_block_2_pace_mean_fmt: string | null
          interval_block_2_power_last: number | null
          interval_block_2_power_mean: number | null
          interval_blocks_count: number | null
          KM: number | null
          Lieu: string | null
          MLS: number | null
          PmoyW: number | null
          "Puissance (Last)": number | null
          Q1: number | null
          Q2: number | null
          Q3: number | null
          Q4: number | null
          "Séance": string | null
          session_group_id: string | null
          session_group_order: number | null
          session_group_role: string | null
          session_group_type: string | null
          Source: string | null
          Sport: string | null
          Type: string | null
        }
        Relationships: []
      }
      view_brick_sessions_karo: {
        Row: {
          athlete: string | null
          bike_activity_name: string | null
          bike_avg_hr: number | null
          bike_avg_power: number | null
          bike_decoupling_index: number | null
          bike_distance_m: number | null
          bike_duration_sec: number | null
          bike_mls: number | null
          bike_nolio_id: string | null
          bike_session_date: string | null
          run_activity_name: string | null
          run_avg_hr: number | null
          run_decoupling_index: number | null
          run_distance_m: number | null
          run_duration_sec: number | null
          run_interval_pace_last: number | null
          run_interval_pace_mean: number | null
          run_mls: number | null
          run_nolio_id: string | null
          run_session_date: string | null
          session_group_id: string | null
        }
        Relationships: []
      }
      view_health_radar: {
        Row: {
          athlete: string | null
          date: string | null
          fc_repos: number | null
          poids: number | null
          rmssd_matinal: number | null
          tendance_rmssd_pct: number | null
        }
        Relationships: []
      }
      view_live_flux: {
        Row: {
          athlete: string | null
          bpm_moyen: number | null
          date_heure: string | null
          decouplage: number | null
          duree_min: number | null
          hum: number | null
          km: number | null
          mls: number | null
          rpe: number | null
          seance: string | null
          sport: string | null
          temp: number | null
          type_seance: string | null
        }
        Relationships: []
      }
      view_performance_audit: {
        Row: {
          athlete: string | null
          course_name: string | null
          date: string | null
          decoupling_q1: number | null
          decoupling_q2: number | null
          decoupling_q3: number | null
          decoupling_q4: number | null
          derive_totale_pct: number | null
          dist_totale_km: number | null
          sport: string | null
          temps_min: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
