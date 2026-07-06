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
      ai_settings: {
        Row: {
          created_at: string
          id: string
          model: string | null
          provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          space_id: string | null
          user_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          space_id?: string | null
          user_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          space_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_selections: {
        Row: {
          calendar_color: string | null
          calendar_id: string
          calendar_name: string
          created_at: string
          enabled: boolean
          id: string
          user_id: string
        }
        Insert: {
          calendar_color?: string | null
          calendar_id: string
          calendar_name: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id: string
        }
        Update: {
          calendar_color?: string | null
          calendar_id?: string
          calendar_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          google_email: string | null
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          google_email?: string | null
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          google_email?: string | null
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          space_id: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          space_id?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          space_id?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_copilot_segments: {
        Row: {
          analysis_snapshot: Json | null
          content: string
          created_at: string
          id: string
          relative_start_seconds: number | null
          session_id: string
          source: string
          speaker_name: string | null
          user_id: string
        }
        Insert: {
          analysis_snapshot?: Json | null
          content: string
          created_at?: string
          id?: string
          relative_start_seconds?: number | null
          session_id: string
          source?: string
          speaker_name?: string | null
          user_id: string
        }
        Update: {
          analysis_snapshot?: Json | null
          content?: string
          created_at?: string
          id?: string
          relative_start_seconds?: number | null
          session_id?: string
          source?: string
          speaker_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_copilot_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "meeting_copilot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_copilot_sessions: {
        Row: {
          analysis: Json
          bot_error: string | null
          bot_id: string | null
          bot_joined_at: string | null
          bot_left_at: string | null
          bot_name: string | null
          bot_status: string | null
          created_at: string
          ended_at: string | null
          id: string
          meeting_url: string | null
          profile: string
          provider: string | null
          started_at: string
          status: string
          title: string
          transcript: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          bot_error?: string | null
          bot_id?: string | null
          bot_joined_at?: string | null
          bot_left_at?: string | null
          bot_name?: string | null
          bot_status?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          meeting_url?: string | null
          profile?: string
          provider?: string | null
          started_at?: string
          status?: string
          title?: string
          transcript?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          bot_error?: string | null
          bot_id?: string | null
          bot_joined_at?: string | null
          bot_left_at?: string | null
          bot_name?: string | null
          bot_status?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          meeting_url?: string | null
          profile?: string
          provider?: string | null
          started_at?: string
          status?: string
          title?: string
          transcript?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      note_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          guest_id: string | null
          id: string
          note_id: string
          user_id: string | null
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string
          guest_id?: string | null
          id?: string
          note_id: string
          user_id?: string | null
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          guest_id?: string | null
          id?: string
          note_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_comments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "note_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_comments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_edit_history: {
        Row: {
          change_summary: string | null
          content_snapshot: string | null
          created_at: string
          editor_name: string
          guest_id: string | null
          id: string
          note_id: string
          user_id: string | null
        }
        Insert: {
          change_summary?: string | null
          content_snapshot?: string | null
          created_at?: string
          editor_name: string
          guest_id?: string | null
          id?: string
          note_id: string
          user_id?: string | null
        }
        Update: {
          change_summary?: string | null
          content_snapshot?: string | null
          created_at?: string
          editor_name?: string
          guest_id?: string | null
          id?: string
          note_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_edit_history_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "note_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_edit_history_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_guests: {
        Row: {
          created_at: string
          guest_name: string
          guest_token: string
          id: string
        }
        Insert: {
          created_at?: string
          guest_name: string
          guest_token?: string
          id?: string
        }
        Update: {
          created_at?: string
          guest_name?: string
          guest_token?: string
          id?: string
        }
        Relationships: []
      }
      note_shares: {
        Row: {
          allow_ai: boolean
          allow_comments: boolean
          allow_edit: boolean
          created_at: string
          created_by: string
          id: string
          note_id: string
          share_token: string
        }
        Insert: {
          allow_ai?: boolean
          allow_comments?: boolean
          allow_edit?: boolean
          created_at?: string
          created_by: string
          id?: string
          note_id: string
          share_token?: string
        }
        Update: {
          allow_ai?: boolean
          allow_comments?: boolean
          allow_edit?: boolean
          created_at?: string
          created_by?: string
          id?: string
          note_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          space_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          space_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          space_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          client_id: string
          client_name: string
          client_secret_hash: string | null
          created_at: string
          grant_types: string[]
          id: string
          redirect_uris: string[]
          scope: string
          token_endpoint_auth_method: string
        }
        Insert: {
          client_id: string
          client_name?: string
          client_secret_hash?: string | null
          created_at?: string
          grant_types?: string[]
          id?: string
          redirect_uris?: string[]
          scope?: string
          token_endpoint_auth_method?: string
        }
        Update: {
          client_id?: string
          client_name?: string
          client_secret_hash?: string | null
          created_at?: string
          grant_types?: string[]
          id?: string
          redirect_uris?: string[]
          scope?: string
          token_endpoint_auth_method?: string
        }
        Relationships: []
      }
      oauth_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string
          code_challenge_method: string
          created_at: string
          expires_at: string
          redirect_uri: string
          scope: string
          supabase_refresh_token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          code: string
          code_challenge: string
          code_challenge_method?: string
          created_at?: string
          expires_at: string
          redirect_uri: string
          scope?: string
          supabase_refresh_token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string
          code_challenge_method?: string
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          scope?: string
          supabase_refresh_token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_refresh_tokens: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          scope: string
          supabase_refresh_token: string
          token_hash: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          scope?: string
          supabase_refresh_token: string
          token_hash: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          scope?: string
          supabase_refresh_token?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          reminder_time: string
          sent: boolean | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_time: string
          sent?: boolean | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reminder_time?: string
          sent?: boolean | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      space_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      space_invites: {
        Row: {
          accepted: boolean
          created_at: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string
          invited_email: string | null
          role: Database["public"]["Enums"]["space_role"]
          space_id: string
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["space_role"]
          space_id: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["space_role"]
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_invites_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["space_role"]
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["space_role"]
          space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["space_role"]
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "space_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      study_areas: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_entries: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          entry_date: string | null
          highlight: string | null
          id: string
          kind: string
          notes: string | null
          source_url: string | null
          summary: string
          tags: string[]
          title: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          entry_date?: string | null
          highlight?: string | null
          id?: string
          kind?: string
          notes?: string | null
          source_url?: string | null
          summary: string
          tags?: string[]
          title: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          entry_date?: string | null
          highlight?: string | null
          id?: string
          kind?: string
          notes?: string | null
          source_url?: string | null
          summary?: string
          tags?: string[]
          title?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_entries_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_topics: {
        Row: {
          area_id: string
          created_at: string
          description: string | null
          id: string
          last_updated_at: string | null
          notes: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          description?: string | null
          id?: string
          last_updated_at?: string | null
          notes?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          description?: string | null
          id?: string
          last_updated_at?: string | null
          notes?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_topics_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "study_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          status: string
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          status?: string
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tagged_snippets: {
        Row: {
          created_at: string
          id: string
          note_id: string
          snippet_text: string
          tag: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          snippet_text: string
          tag?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          snippet_text?: string
          tag?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tagged_snippets_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          id: string
          linked_task_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_task_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_task_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_materials: {
        Row: {
          created_at: string
          description: string | null
          id: string
          space_id: string | null
          tag: string | null
          task_id: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          space_id?: string | null
          tag?: string | null
          task_id?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          space_id?: string | null
          tag?: string | null
          task_id?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_materials_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_materials_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          completion_note: string | null
          created_at: string
          day_order: number | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          execution_complexity: Database["public"]["Enums"]["task_execution_complexity"]
          estimated_minutes: number | null
          id: string
          note_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence: string | null
          recurrence_parent_id: string | null
          scheduled_time: string | null
          space_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tag: string | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string
          day_order?: number | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          execution_complexity?: Database["public"]["Enums"]["task_execution_complexity"]
          estimated_minutes?: number | null
          id?: string
          note_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: string | null
          recurrence_parent_id?: string | null
          scheduled_time?: string | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tag?: string | null
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string
          day_order?: number | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          execution_complexity?: Database["public"]["Enums"]["task_execution_complexity"]
          estimated_minutes?: number | null
          id?: string
          note_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: string | null
          recurrence_parent_id?: string | null
          scheduled_time?: string | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tag?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_chat_links: {
        Row: {
          chat_id: number
          enabled: boolean
          id: string
          link_code: string | null
          linked_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          enabled?: boolean
          id?: string
          link_code?: string | null
          linked_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          enabled?: boolean
          id?: string
          link_code?: string | null
          linked_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          processed: boolean
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          processed?: boolean
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          processed?: boolean
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          phone_number: string | null
          updated_at: string
          user_id: string
          webhook_secret: string
          zapier_webhook_url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string
          zapier_webhook_url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string
          zapier_webhook_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_space: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      is_space_member: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      purge_old_deleted_tasks: { Args: never; Returns: undefined }
    }
    Enums: {
      space_role: "owner" | "editor" | "viewer"
      task_execution_complexity: "easy" | "medium" | "hard"
      task_priority: "low" | "medium" | "high"
      task_status:
        | "todo"
        | "in_progress"
        | "waiting"
        | "completed"
        | "cancelled"
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
      space_role: ["owner", "editor", "viewer"],
      task_execution_complexity: ["easy", "medium", "hard"],
      task_priority: ["low", "medium", "high"],
      task_status: ["todo", "in_progress", "waiting", "completed", "cancelled"],
    },
  },
} as const
