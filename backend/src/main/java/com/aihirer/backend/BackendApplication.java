package com.aihirer.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@SpringBootApplication
public class BackendApplication implements CommandLineRunner {

	private static final Logger logger = LoggerFactory.getLogger(BackendApplication.class);

	@Autowired
	private JdbcTemplate jdbcTemplate;

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

	@Override
	public void run(String... args) throws Exception {
		try {
			jdbcTemplate.execute("ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_current_stage_check");
			jdbcTemplate
					.execute("ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_overall_status_check");
			jdbcTemplate.execute("ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_new_stage_check");
			jdbcTemplate.execute("ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_old_stage_check");
			jdbcTemplate.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_round_status_check");

			// New Columns Migration
			try {
				jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN active_round INT DEFAULT 0 NOT NULL");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN total_rounds INT DEFAULT 5 NOT NULL");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute(
						"ALTER TABLE jobs ADD COLUMN round_status VARCHAR(255) DEFAULT 'NOT_STARTED' NOT NULL");
			} catch (Exception e) {
			}

			try {
				jdbcTemplate.execute(
						"ALTER TABLE applications ADD COLUMN test_status VARCHAR(255) DEFAULT 'NOT_AVAILABLE' NOT NULL");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute("ALTER TABLE applications ADD COLUMN test_started_at TIMESTAMP");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute("ALTER TABLE applications ADD COLUMN test_expires_at TIMESTAMP");
			} catch (Exception e) {
			}

			// New AI Columns for Jobs
			try {
				jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN min_github_score INT DEFAULT 0 NOT NULL");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN min_linkedin_score INT DEFAULT 0 NOT NULL");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN ai_summary TEXT");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN ai_responsibilities TEXT");
			} catch (Exception e) {
			}
			try {
				jdbcTemplate.execute("ALTER TABLE jobs ADD COLUMN ai_skills JSONB");
			} catch (Exception e) {
			}

			// Ensure application_rounds table exists
			try {
				jdbcTemplate.execute(
						"CREATE TABLE IF NOT EXISTS application_rounds (" +
								"id UUID PRIMARY KEY, " +
								"application_id UUID NOT NULL, " +
								"round_number INT NOT NULL, " +
								"is_activated BOOLEAN DEFAULT FALSE, " +
								"activated_at TIMESTAMP, " +
								"activated_by UUID, " +
								"status VARCHAR(255) DEFAULT 'NOT_STARTED', " +
								"score DOUBLE PRECISION, " +
								"attempts INT DEFAULT 0" +
								")");
			} catch (Exception e) {
				logger.warn("Could not ensure application_rounds table: {}", e.getMessage());
			}

			// Comprehensive column migration for round_name
			try {
				// 1. Rename round_type to round_name if it exists
				try {
					jdbcTemplate.execute("ALTER TABLE application_rounds RENAME COLUMN round_type TO round_name");
					logger.info("Renamed round_type to round_name in application_rounds.");
				} catch (Exception e) {
					// Either round_type missing or round_name already exists
				}

				// 2. Add round_name if still missing
				try {
					jdbcTemplate
							.execute("ALTER TABLE application_rounds ADD COLUMN IF NOT EXISTS round_name VARCHAR(255)");
				} catch (Exception e) {
				}

				// 3. Populate NULLs so we don't violate NOT NULL constraints later
				// If round_type existed, it's already copied. For others, we need a default.
				jdbcTemplate
						.execute("UPDATE application_rounds SET round_name = 'Hiring Round' WHERE round_name IS NULL");

				// 4. Finally enforce NOT NULL if it isn't already (optional but good for
				// consistency with Entity)
				try {
					jdbcTemplate.execute("ALTER TABLE application_rounds ALTER COLUMN round_name SET NOT NULL");
				} catch (Exception e) {
				}

			} catch (Exception e) {
				logger.warn("Error during application_rounds column migration: {}", e.getMessage());
			}

			logger.info("Successfully dropped check constraints and ensured columns exist.");
		} catch (Exception e) {
			logger.warn("Could not drop constraints: {}", e.getMessage());
		}
	}
}
