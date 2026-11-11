CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`person_type` text DEFAULT 'PF' NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`cep` text DEFAULT '' NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`number` text DEFAULT '' NOT NULL,
	`district` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`complement` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clients_company_idx` ON `clients` (`company_id`,`name`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_name` text DEFAULT '' NOT NULL,
	`cnpj` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`logo` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`quote_seq` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`used_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_hash_unique` ON `invites` (`code_hash`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `material_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`material_id` text NOT NULL,
	`price` real NOT NULL,
	`pack_qty` real NOT NULL,
	`pack_unit` text NOT NULL,
	`user_id` text,
	`changed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mph_material_idx` ON `material_price_history` (`material_id`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`purchase_unit` text NOT NULL,
	`pack_qty` real NOT NULL,
	`pack_unit` text NOT NULL,
	`usage_unit` text NOT NULL,
	`purchase_price` real NOT NULL,
	`supplier_id` text,
	`length_mm` real,
	`width_mm` real,
	`thickness_mm` real,
	`weight_kg` real,
	`status` text DEFAULT 'ativo' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`price_updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `materials_company_idx` ON `materials` (`company_id`,`name`);--> statement-breakpoint
CREATE TABLE `quote_events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`quote_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_events_quote_idx` ON `quote_events` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quote_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`quote_id` text NOT NULL,
	`version` integer NOT NULL,
	`document` text NOT NULL,
	`totals` text NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_versions_uq` ON `quote_versions` (`quote_id`,`version`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`number` integer NOT NULL,
	`code` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`last_contact_at` text,
	`next_followup_at` text,
	`loss_reason` text DEFAULT '' NOT NULL,
	`crm_notes` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_company_number_uq` ON `quotes` (`company_id`,`number`);--> statement-breakpoint
CREATE INDEX `quotes_company_status_idx` ON `quotes` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `quotes_client_idx` ON `quotes` (`client_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`mode` text DEFAULT 'hour' NOT NULL,
	`unit` text DEFAULT 'h' NOT NULL,
	`hourly_cost` real DEFAULT 0 NOT NULL,
	`fixed_price` real DEFAULT 0 NOT NULL,
	`estimated_hours` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ativo' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `services_company_idx` ON `services` (`company_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `suppliers_company_idx` ON `suppliers` (`company_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_company_idx` ON `users` (`company_id`);