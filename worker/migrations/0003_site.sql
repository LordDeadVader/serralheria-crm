CREATE TABLE `site_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`service` text DEFAULT '' NOT NULL,
	`material` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`measures` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`files` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'novo' NOT NULL,
	`forward_status` text DEFAULT '' NOT NULL,
	`client_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `site_leads_company_idx` ON `site_leads` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `site_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`materials` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`year` text DEFAULT '' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`cover_index` integer DEFAULT 0 NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_projects_slug_uq` ON `site_projects` (`company_id`,`slug`);--> statement-breakpoint
CREATE INDEX `site_projects_pub_idx` ON `site_projects` (`company_id`,`published`);--> statement-breakpoint
CREATE TABLE `site_services` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`image` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_services_slug_uq` ON `site_services` (`company_id`,`slug`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`company_id` text PRIMARY KEY NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `site_testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`text` text NOT NULL,
	`rating` integer,
	`source` text DEFAULT '' NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `site_testimonials_company_idx` ON `site_testimonials` (`company_id`);