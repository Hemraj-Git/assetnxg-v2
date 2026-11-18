// Generated from the live v2 schema (Supabase gen types). Do not edit by hand:
// regenerate after every migration.

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
      approval_delegations: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string
          from_user_id: string
          id: string
          organization_id: string
          reason: string | null
          starts_on: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on: string
          from_user_id: string
          id?: string
          organization_id: string
          reason?: string | null
          starts_on: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string
          from_user_id?: string
          id?: string
          organization_id?: string
          reason?: string | null
          starts_on?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_delegations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_delegations_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_delegations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_delegations_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          assigned_to: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          installation_date: string | null
          last_serviced_on: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          price: number | null
          purchase_date: string | null
          purchased_from_id: string | null
          qr_key: string
          retire_reason: string | null
          retired_on: string | null
          room_id: string
          serial_no: string | null
          sla_priority: Database["public"]["Enums"]["sla_priority"] | null
          spec_values: Json
          status: Database["public"]["Enums"]["asset_status"]
          sub_category_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          installation_date?: string | null
          last_serviced_on?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          price?: number | null
          purchase_date?: string | null
          purchased_from_id?: string | null
          qr_key?: string
          retire_reason?: string | null
          retired_on?: string | null
          room_id: string
          serial_no?: string | null
          sla_priority?: Database["public"]["Enums"]["sla_priority"] | null
          spec_values?: Json
          status?: Database["public"]["Enums"]["asset_status"]
          sub_category_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          installation_date?: string | null
          last_serviced_on?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          price?: number | null
          purchase_date?: string | null
          purchased_from_id?: string | null
          qr_key?: string
          retire_reason?: string | null
          retired_on?: string | null
          room_id?: string
          serial_no?: string | null
          sla_priority?: Database["public"]["Enums"]["sla_priority"] | null
          spec_values?: Json
          status?: Database["public"]["Enums"]["asset_status"]
          sub_category_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_organization_id_purchased_from_id_fkey"
            columns: ["organization_id", "purchased_from_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "assets_organization_id_room_id_fkey"
            columns: ["organization_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "assets_organization_id_sub_category_id_fkey"
            columns: ["organization_id", "sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          campus_id: string
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          total_floors: number | null
          updated_at: string
        }
        Insert: {
          campus_id: string
          code?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          total_floors?: number | null
          updated_at?: string
        }
        Update: {
          campus_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          total_floors?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_organization_id_campus_id_fkey"
            columns: ["organization_id", "campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "buildings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          items: Json
          kind: Database["public"]["Enums"]["checklist_kind"]
          organization_id: string
          repeats: Database["public"]["Enums"]["repeat_interval"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          items?: Json
          kind: Database["public"]["Enums"]["checklist_kind"]
          organization_id: string
          repeats: Database["public"]["Enums"]["repeat_interval"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          items?: Json
          kind?: Database["public"]["Enums"]["checklist_kind"]
          organization_id?: string
          repeats?: Database["public"]["Enums"]["repeat_interval"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          asset_ids: string[]
          code: string
          contract_no: string | null
          cost: number | null
          coverage: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          kind: Database["public"]["Enums"]["contract_kind"]
          not_renewing: boolean
          organization_id: string
          renewed_from_id: string | null
          starts_on: string
          updated_at: string
          vendor_id: string | null
          visits_per_year: number | null
        }
        Insert: {
          asset_ids?: string[]
          code?: string
          contract_no?: string | null
          cost?: number | null
          coverage?: string | null
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          kind: Database["public"]["Enums"]["contract_kind"]
          not_renewing?: boolean
          organization_id: string
          renewed_from_id?: string | null
          starts_on: string
          updated_at?: string
          vendor_id?: string | null
          visits_per_year?: number | null
        }
        Update: {
          asset_ids?: string[]
          code?: string
          contract_no?: string | null
          cost?: number | null
          coverage?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          kind?: Database["public"]["Enums"]["contract_kind"]
          not_renewing?: boolean
          organization_id?: string
          renewed_from_id?: string | null
          starts_on?: string
          updated_at?: string
          vendor_id?: string | null
          visits_per_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_renewed_from_id_fkey"
            columns: ["organization_id", "renewed_from_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "contracts_organization_id_vendor_id_fkey"
            columns: ["organization_id", "vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      counters: {
        Row: {
          kind: string
          last_value: number
          organization_id: string
          year: number
        }
        Insert: {
          kind: string
          last_value?: number
          organization_id: string
          year?: number
        }
        Update: {
          kind?: string
          last_value?: number
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          head_user_id: string | null
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_parent_id_fkey"
            columns: ["organization_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      documents: {
        Row: {
          asset_ids: string[]
          code: string
          contract_ids: string[]
          created_at: string
          doc_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          organization_id: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_ids?: string[]
          code?: string
          contract_ids?: string[]
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size?: number
          file_type?: string
          id?: string
          organization_id: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_ids?: string[]
          code?: string
          contract_ids?: string[]
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          organization_id: string
          roles: Database["public"]["Enums"]["app_role"][]
          support_access: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          organization_id: string
          roles: Database["public"]["Enums"]["app_role"][]
          support_access?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          organization_id?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          support_access?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_department_fk"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          organization_id: string
          pushed_at: string | null
          read_at: string | null
          ref_id: string | null
          ref_number: string | null
          ref_table: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          organization_id: string
          pushed_at?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_number?: string | null
          ref_table?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          organization_id?: string
          pushed_at?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_number?: string | null
          ref_table?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          changed_at: string
          changed_by: string | null
          enabled: boolean
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          enabled?: boolean
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          enabled?: boolean
          module?: Database["public"]["Enums"]["app_module"]
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          locale: string
          logo_mark_url: string | null
          logo_url: string | null
          name: string
          settings: Json
          short_name: string
          slug: string
          status: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          locale?: string
          logo_mark_url?: string | null
          logo_url?: string | null
          name: string
          settings?: Json
          short_name: string
          slug: string
          status?: string
          time_zone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          locale?: string
          logo_mark_url?: string | null
          logo_url?: string | null
          name?: string
          settings?: Json
          short_name?: string
          slug?: string
          status?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_signed_in_at: string | null
          full_name: string | null
          id: string
          is_support: boolean | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_signed_in_at?: string | null
          full_name?: string | null
          id: string
          is_support?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_signed_in_at?: string | null
          full_name?: string | null
          id?: string
          is_support?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      room_types: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          area_sqft: number | null
          building_id: string
          code: string
          created_at: string
          floor: string | null
          id: string
          is_reservable: boolean
          last_printed_at: string | null
          name: string
          organization_id: string
          qr_key: string
          room_type_id: string | null
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          area_sqft?: number | null
          building_id: string
          code?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_reservable?: boolean
          last_printed_at?: string | null
          name: string
          organization_id: string
          qr_key?: string
          room_type_id?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          area_sqft?: number | null
          building_id?: string
          code?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_reservable?: boolean
          last_printed_at?: string | null
          name?: string
          organization_id?: string
          qr_key?: string
          room_type_id?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_organization_id_building_id_fkey"
            columns: ["organization_id", "building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_organization_id_room_type_id_fkey"
            columns: ["organization_id", "room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sub_categories: {
        Row: {
          asset_fields: Json
          category_id: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          sla_priority: Database["public"]["Enums"]["sla_priority"] | null
          template_ids: string[]
          updated_at: string
        }
        Insert: {
          asset_fields?: Json
          category_id: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          sla_priority?: Database["public"]["Enums"]["sla_priority"] | null
          template_ids?: string[]
          updated_at?: string
        }
        Update: {
          asset_fields?: Json
          category_id?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          sla_priority?: Database["public"]["Enums"]["sla_priority"] | null
          template_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_categories_organization_id_category_id_fkey"
            columns: ["organization_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sub_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          category_ids: string[]
          code: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category_ids?: string[]
          code?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category_ids?: string[]
          code?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      link_documents: {
        Args: {
          p_document_ids: string[]
          p_link: boolean
          p_org: string
          p_target: string
          p_target_id: string
        }
        Returns: number
      }
      org_add_member: {
        Args: {
          p_department?: string
          p_email: string
          p_org: string
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: string
      }
      org_approver_map: {
        Args: { p_org: string }
        Returns: {
          approver_role: Database["public"]["Enums"]["app_role"]
          approver_user_id: string
          note: string
          on_behalf_of: string
          user_id: string
        }[]
      }
      org_brand: {
        Args: { org_slug: string }
        Returns: {
          id: string
          logo_mark_url: string
          logo_url: string
          name: string
          short_name: string
          slug: string
        }[]
      }
      org_lookup: {
        Args: { org_slug: string }
        Returns: {
          id: string
          logo_mark_url: string
          logo_url: string
          name: string
          short_name: string
          slug: string
          status: string
        }[]
      }
      platform_add_member: {
        Args: {
          p_email: string
          p_org: string
          p_roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: string
      }
      platform_create_organization: {
        Args: {
          p_currency?: string
          p_locale?: string
          p_modules?: Database["public"]["Enums"]["app_module"][]
          p_name: string
          p_short_name: string
          p_slug: string
          p_time_zone?: string
        }
        Returns: string
      }
      platform_grant_support: { Args: { p_org: string }; Returns: undefined }
      platform_organizations: {
        Args: { p_org?: string }
        Returns: {
          admin_count: number
          created_at: string
          currency: string
          id: string
          locale: string
          logo_mark_url: string
          logo_url: string
          member_count: number
          modules: Database["public"]["Enums"]["app_module"][]
          my_support_access: boolean
          name: string
          short_name: string
          slug: string
          status: string
          time_zone: string
        }[]
      }
      platform_revoke_support: { Args: { p_org: string }; Returns: undefined }
      platform_set_logo: {
        Args: { p_kind: string; p_org: string; p_url: string }
        Returns: undefined
      }
      platform_set_modules: {
        Args: {
          p_modules: Database["public"]["Enums"]["app_module"][]
          p_org: string
        }
        Returns: undefined
      }
      platform_set_status: {
        Args: { p_org: string; p_status: string }
        Returns: undefined
      }
      platform_update_organization: {
        Args: {
          p_currency: string
          p_locale: string
          p_name: string
          p_org: string
          p_short_name: string
          p_time_zone: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_module:
        | "maintenance"
        | "housekeeping"
        | "inspections"
        | "outside_repairs"
        | "reservations"
        | "spares"
        | "warranty_amc"
        | "procurement"
        | "ai_assistant"
      app_role:
        | "admin"
        | "faculty"
        | "technician"
        | "housekeeping"
        | "guest"
        | "procurement_manager"
        | "procurement_executive"
        | "hod"
        | "accounts"
        | "director"
        | "security_supervisor"
        | "store_incharge"
        | "dean"
        | "quality_manager"
      asset_status: "operational" | "under_maintenance" | "in_storage" | "retired"
      checklist_kind: "pm" | "inspection"
      contract_kind: "amc" | "camc" | "warranty" | "extended_warranty"
      document_type:
        | "invoice"
        | "warranty"
        | "user_guide"
        | "amc_contract"
        | "other"
      notification_type:
        | "wo_assigned"
        | "inspection_assigned"
        | "auto_checkout"
        | "vendor_handover"
        | "outside_repair_sent"
        | "outside_repair_overdue"
        | "request_resolved"
        | "request_escalated"
        | "request_closed"
        | "due_today"
      repeat_interval: "weekly" | "monthly" | "quarterly" | "half_yearly" | "annually"
      room_status: "available" | "under_maintenance"
      sla_priority: "critical" | "high" | "medium" | "low"
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
    Enums: {
      app_module: [
        "maintenance",
        "housekeeping",
        "inspections",
        "outside_repairs",
        "reservations",
        "spares",
        "warranty_amc",
        "procurement",
        "ai_assistant",
      ],
      app_role: [
        "admin",
        "faculty",
        "technician",
        "housekeeping",
        "guest",
        "procurement_manager",
        "procurement_executive",
        "hod",
        "accounts",
        "director",
        "security_supervisor",
        "store_incharge",
        "dean",
        "quality_manager",
      ],
      asset_status: ["operational", "under_maintenance", "in_storage", "retired"],
      checklist_kind: ["pm", "inspection"],
      contract_kind: ["amc", "camc", "warranty", "extended_warranty"],
      document_type: [
        "invoice",
        "warranty",
        "user_guide",
        "amc_contract",
        "other",
      ],
      notification_type: [
        "wo_assigned",
        "inspection_assigned",
        "auto_checkout",
        "vendor_handover",
        "outside_repair_sent",
        "outside_repair_overdue",
        "request_resolved",
        "request_escalated",
        "request_closed",
        "due_today",
      ],
      repeat_interval: ["weekly", "monthly", "quarterly", "half_yearly", "annually"],
      room_status: ["available", "under_maintenance"],
      sla_priority: ["critical", "high", "medium", "low"],
    },
  },
} as const
