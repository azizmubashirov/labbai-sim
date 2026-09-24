-- migration-safe: Labbai local copilot (ported from Arena). Additive only: new enums, tables, and a user-insert trigger granting copilot access.
CREATE TYPE "public"."local_copilot_patch_status" AS ENUM('pending', 'applied', 'rejected', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."local_copilot_audit_status" AS ENUM('success', 'failure', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."local_copilot_default_model" AS ENUM('openai', 'claude', 'gemini-2.5-pro', 'gemini-3.1-pro', 'bedrock-claude-opus-5', 'bedrock-claude-sonnet-5', 'bedrock-claude-opus-4-8', 'bedrock-claude-opus-4-6', 'bedrock-claude-sonnet-4-6', 'bedrock-zai-glm-5', 'bedrock-nemotron-super-3-120b', 'bedrock-mistral-large-3', 'bedrock-llama-3.3-70b', 'bedrock-deepseek-v3.2', 'gemini-3.8-flash', 'vertex-gemini-3.8-flash');
--> statement-breakpoint
CREATE TABLE public.local_copilot_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    workspace_id text NOT NULL,
    workflow_id text,
    conversation_id uuid,
    patch_id uuid,
    action text NOT NULL,
    summary text,
    status public.local_copilot_audit_status DEFAULT 'success'::public.local_copilot_audit_status NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE public.local_copilot_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    workspace_id text NOT NULL,
    workflow_id text,
    title text,
    model text NOT NULL,
    provider text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE public.local_copilot_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content jsonb NOT NULL,
    seq integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE public.local_copilot_patches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id text NOT NULL,
    workflow_id text NOT NULL,
    summary text NOT NULL,
    patch jsonb NOT NULL,
    status public.local_copilot_patch_status DEFAULT 'pending'::public.local_copilot_patch_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone
);
--> statement-breakpoint
CREATE TABLE public.local_copilot_tool_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid,
    tool_name text NOT NULL,
    tool_call_id text NOT NULL,
    arguments jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);
--> statement-breakpoint
CREATE TABLE public.local_copilot_user_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    email text NOT NULL,
    has_access boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    local_only boolean DEFAULT true NOT NULL,
    default_model public.local_copilot_default_model DEFAULT 'openai'::public.local_copilot_default_model NOT NULL
);
--> statement-breakpoint
CREATE TABLE public.local_copilot_user_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    workspace_id text,
    key text NOT NULL,
    value text NOT NULL,
    memory_type text DEFAULT 'preference'::text NOT NULL,
    source text DEFAULT 'explicit'::text NOT NULL,
    confidence double precision DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_audit_logs
    ADD CONSTRAINT local_copilot_audit_logs_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_conversations
    ADD CONSTRAINT local_copilot_conversations_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_messages
    ADD CONSTRAINT local_copilot_messages_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_patches
    ADD CONSTRAINT local_copilot_patches_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_tool_calls
    ADD CONSTRAINT local_copilot_tool_calls_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_user_access
    ADD CONSTRAINT local_copilot_user_access_pkey PRIMARY KEY (id);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_user_memory
    ADD CONSTRAINT local_copilot_user_memory_pkey PRIMARY KEY (id);
--> statement-breakpoint
CREATE INDEX local_copilot_audit_logs_created_at_idx ON public.local_copilot_audit_logs USING btree (created_at);
--> statement-breakpoint
CREATE INDEX local_copilot_audit_logs_user_id_idx ON public.local_copilot_audit_logs USING btree (user_id);
--> statement-breakpoint
CREATE INDEX local_copilot_audit_logs_workflow_id_idx ON public.local_copilot_audit_logs USING btree (workflow_id);
--> statement-breakpoint
CREATE INDEX local_copilot_audit_logs_workspace_id_idx ON public.local_copilot_audit_logs USING btree (workspace_id);
--> statement-breakpoint
CREATE INDEX local_copilot_conversations_updated_at_idx ON public.local_copilot_conversations USING btree (updated_at);
--> statement-breakpoint
CREATE INDEX local_copilot_conversations_user_id_idx ON public.local_copilot_conversations USING btree (user_id);
--> statement-breakpoint
CREATE INDEX local_copilot_conversations_user_workflow_idx ON public.local_copilot_conversations USING btree (user_id, workflow_id);
--> statement-breakpoint
CREATE INDEX local_copilot_conversations_workflow_id_idx ON public.local_copilot_conversations USING btree (workflow_id);
--> statement-breakpoint
CREATE INDEX local_copilot_conversations_workspace_id_idx ON public.local_copilot_conversations USING btree (workspace_id);
--> statement-breakpoint
CREATE INDEX local_copilot_messages_conversation_seq_idx ON public.local_copilot_messages USING btree (conversation_id, seq);
--> statement-breakpoint
CREATE INDEX local_copilot_patches_conversation_id_idx ON public.local_copilot_patches USING btree (conversation_id);
--> statement-breakpoint
CREATE INDEX local_copilot_patches_status_idx ON public.local_copilot_patches USING btree (status);
--> statement-breakpoint
CREATE INDEX local_copilot_patches_workflow_id_idx ON public.local_copilot_patches USING btree (workflow_id);
--> statement-breakpoint
CREATE INDEX local_copilot_tool_calls_conversation_id_idx ON public.local_copilot_tool_calls USING btree (conversation_id);
--> statement-breakpoint
CREATE INDEX local_copilot_tool_calls_tool_call_id_idx ON public.local_copilot_tool_calls USING btree (tool_call_id);
--> statement-breakpoint
CREATE INDEX local_copilot_user_access_email_idx ON public.local_copilot_user_access USING btree (email);
--> statement-breakpoint
CREATE UNIQUE INDEX local_copilot_user_access_user_id_uidx ON public.local_copilot_user_access USING btree (user_id);
--> statement-breakpoint
CREATE INDEX local_copilot_user_memory_type_idx ON public.local_copilot_user_memory USING btree (memory_type);
--> statement-breakpoint
CREATE INDEX local_copilot_user_memory_user_id_idx ON public.local_copilot_user_memory USING btree (user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX local_copilot_user_memory_user_key_global_uidx ON public.local_copilot_user_memory USING btree (user_id, key) WHERE (workspace_id IS NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX local_copilot_user_memory_user_workspace_key_uidx ON public.local_copilot_user_memory USING btree (user_id, workspace_id, key) WHERE (workspace_id IS NOT NULL);
--> statement-breakpoint
CREATE INDEX local_copilot_user_memory_workspace_id_idx ON public.local_copilot_user_memory USING btree (workspace_id);
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_audit_logs
    ADD CONSTRAINT local_copilot_audit_logs_conversation_id_local_copilot_conversa FOREIGN KEY (conversation_id) REFERENCES public.local_copilot_conversations(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_audit_logs
    ADD CONSTRAINT local_copilot_audit_logs_patch_id_local_copilot_patches_id_fk FOREIGN KEY (patch_id) REFERENCES public.local_copilot_patches(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_audit_logs
    ADD CONSTRAINT local_copilot_audit_logs_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_audit_logs
    ADD CONSTRAINT local_copilot_audit_logs_workflow_id_workflow_id_fk FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_audit_logs
    ADD CONSTRAINT local_copilot_audit_logs_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_conversations
    ADD CONSTRAINT local_copilot_conversations_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_conversations
    ADD CONSTRAINT local_copilot_conversations_workflow_id_workflow_id_fk FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_conversations
    ADD CONSTRAINT local_copilot_conversations_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_messages
    ADD CONSTRAINT local_copilot_messages_conversation_id_local_copilot_conversati FOREIGN KEY (conversation_id) REFERENCES public.local_copilot_conversations(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_patches
    ADD CONSTRAINT local_copilot_patches_conversation_id_local_copilot_conversatio FOREIGN KEY (conversation_id) REFERENCES public.local_copilot_conversations(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_patches
    ADD CONSTRAINT local_copilot_patches_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_patches
    ADD CONSTRAINT local_copilot_patches_workflow_id_workflow_id_fk FOREIGN KEY (workflow_id) REFERENCES public.workflow(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_tool_calls
    ADD CONSTRAINT local_copilot_tool_calls_conversation_id_local_copilot_conversa FOREIGN KEY (conversation_id) REFERENCES public.local_copilot_conversations(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_tool_calls
    ADD CONSTRAINT local_copilot_tool_calls_message_id_local_copilot_messages_id_f FOREIGN KEY (message_id) REFERENCES public.local_copilot_messages(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_user_access
    ADD CONSTRAINT local_copilot_user_access_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_user_memory
    ADD CONSTRAINT local_copilot_user_memory_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ONLY public.local_copilot_user_memory
    ADD CONSTRAINT local_copilot_user_memory_workspace_id_workspace_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspace(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION insert_local_copilot_user_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO local_copilot_user_access (id, user_id, email, has_access, local_only, default_model)
  VALUES (gen_random_uuid(), NEW.id, NEW.email, true, true, 'openai'::local_copilot_default_model)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS local_copilot_user_access_on_user_insert ON "user";
--> statement-breakpoint
CREATE TRIGGER local_copilot_user_access_on_user_insert AFTER INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION insert_local_copilot_user_access();
--> statement-breakpoint
INSERT INTO local_copilot_user_access (id, user_id, email, has_access, local_only, default_model)
SELECT gen_random_uuid(), id, email, true, true, 'openai'::local_copilot_default_model FROM "user"
ON CONFLICT (user_id) DO NOTHING;
