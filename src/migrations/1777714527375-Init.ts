import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1777714527375 implements MigrationInterface {
    name = 'Init1777714527375'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."alerts_severity_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "device_id" uuid NOT NULL, "event_type" character varying(100) NOT NULL, "severity" "public"."alerts_severity_enum" NOT NULL, "message" text NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "escalated" boolean NOT NULL DEFAULT false, "search_vector" tsvector, CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_alerts_escalation_window" ON "alerts" ("device_id", "event_type", "occurred_at") `);
        await queryRunner.query(`CREATE INDEX "idx_alerts_occurred_at" ON "alerts" ("occurred_at") `);
        await queryRunner.query(`CREATE INDEX "idx_alerts_severity" ON "alerts" ("severity") `);
        await queryRunner.query(`CREATE INDEX "idx_alerts_device_id" ON "alerts" ("device_id") `);
        await queryRunner.query(`CREATE TYPE "public"."devices_status_enum" AS ENUM('active', 'inactive', 'maintenance')`);
        await queryRunner.query(`CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "status" "public"."devices_status_enum" NOT NULL DEFAULT 'active', "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_bde35b32d03b804b0944331ac85" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_bde35b32d03b804b0944331ac85"`);
        await queryRunner.query(`DROP TABLE "devices"`);
        await queryRunner.query(`DROP TYPE "public"."devices_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_alerts_device_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_alerts_severity"`);
        await queryRunner.query(`DROP INDEX "public"."idx_alerts_occurred_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_alerts_escalation_window"`);
        await queryRunner.query(`DROP TABLE "alerts"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_severity_enum"`);
    }

}
