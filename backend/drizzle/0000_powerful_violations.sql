CREATE TABLE `advocates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`practice` text NOT NULL,
	`bio` text NOT NULL,
	`in_practice_years` integer DEFAULT 0 NOT NULL,
	`admissions` text DEFAULT '[]' NOT NULL,
	`education` text DEFAULT '[]' NOT NULL,
	`prior_experience` text,
	`key_results` text DEFAULT '[]' NOT NULL,
	`languages` text DEFAULT '[]' NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`image_url` text NOT NULL,
	`is_partner` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `advocates_email_unique` ON `advocates` (`email`);--> statement-breakpoint
CREATE INDEX `advocates_practice_idx` ON `advocates` (`practice`);--> statement-breakpoint
CREATE INDEX `advocates_name_idx` ON `advocates` (`name`);--> statement-breakpoint
CREATE INDEX `advocates_partner_idx` ON `advocates` (`is_partner`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`category` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `faqs_sort_idx` ON `faqs` (`sort_order`);--> statement-breakpoint
CREATE TABLE `fixed_fees` (
	`id` text PRIMARY KEY NOT NULL,
	`service` text,
	`title` text,
	`description` text NOT NULL,
	`price` text,
	`period` text,
	`features` text DEFAULT '[]' NOT NULL,
	`popular` integer DEFAULT false NOT NULL,
	`cta_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fixed_fees_sort_idx` ON `fixed_fees` (`sort_order`);--> statement-breakpoint
CREATE TABLE `insights` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`excerpt` text,
	`content` text,
	`category` text NOT NULL,
	`published_date` text,
	`read_time` text NOT NULL,
	`author` text NOT NULL,
	`author_role` text,
	`author_practice` text,
	`author_image_url` text,
	`pull_quote` text,
	`paragraphs` text DEFAULT '[]' NOT NULL,
	`takeaways` text DEFAULT '[]' NOT NULL,
	`image_url` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insights_slug_unique` ON `insights` (`slug`);--> statement-breakpoint
CREATE INDEX `insights_category_idx` ON `insights` (`category`);--> statement-breakpoint
CREATE INDEX `insights_published_idx` ON `insights` (`published_date`);--> statement-breakpoint
CREATE INDEX `insights_author_idx` ON `insights` (`author`);--> statement-breakpoint
CREATE TABLE `intake_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`practice_area` text NOT NULL,
	`urgency` text DEFAULT 'standard-30d' NOT NULL,
	`matter_summary` text NOT NULL,
	`adverse_parties` text,
	`advocate_id` text,
	`preferred_date` text,
	`preferred_time` text,
	`consent_acknowledged` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'website' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_requests_reference_unique` ON `intake_requests` (`reference`);--> statement-breakpoint
CREATE INDEX `intake_kind_idx` ON `intake_requests` (`kind`);--> statement-breakpoint
CREATE INDEX `intake_status_idx` ON `intake_requests` (`status`);--> statement-breakpoint
CREATE INDEX `intake_email_idx` ON `intake_requests` (`email`);--> statement-breakpoint
CREATE INDEX `intake_created_idx` ON `intake_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `matters` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`result` text,
	`result_unit` text,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`what_happened` text,
	`outcome` text,
	`lead_partner` text,
	`lead_advocate_id` text,
	`practice` text,
	`client_type` text,
	`forum` text,
	`year` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matters_slug_unique` ON `matters` (`slug`);--> statement-breakpoint
CREATE INDEX `matters_category_idx` ON `matters` (`category`);--> statement-breakpoint
CREATE INDEX `matters_practice_idx` ON `matters` (`practice`);--> statement-breakpoint
CREATE INDEX `matters_year_idx` ON `matters` (`year`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'subscribed' NOT NULL,
	`source` text DEFAULT 'website' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_email_unique` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_email_idx` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE TABLE `practices` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`num` text,
	`title` text NOT NULL,
	`tagline` text,
	`description` text NOT NULL,
	`short_description` text,
	`full_description` text,
	`starting_fee` text,
	`fee_type` text,
	`fee_basis` text,
	`fee_detail` text,
	`partner_names` text,
	`partner_ids` text DEFAULT '[]' NOT NULL,
	`image_url` text,
	`icon_name` text,
	`what_we_handle` text DEFAULT '[]' NOT NULL,
	`when_clients_call` text DEFAULT '[]' NOT NULL,
	`where_we_argue` text DEFAULT '[]' NOT NULL,
	`matters_count` integer,
	`results` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practices_slug_unique` ON `practices` (`slug`);--> statement-breakpoint
CREATE INDEX `practices_num_idx` ON `practices` (`num`);--> statement-breakpoint
CREATE INDEX `practices_title_idx` ON `practices` (`title`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`quote` text NOT NULL,
	`author` text,
	`role` text NOT NULL,
	`company` text NOT NULL,
	`client_since` text,
	`avatar_url` text,
	`rating` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `testimonials_sort_idx` ON `testimonials` (`sort_order`);