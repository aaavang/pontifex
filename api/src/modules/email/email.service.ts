import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {Transporter} from 'nodemailer';

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
    private readonly logger = new Logger(EmailService.name);
    private transporter: Transporter;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit() {
        const host = this.configService.get<string>('PONTIFEX_SMTP_HOST', 'localhost');
        const port = this.configService.get<number>('PONTIFEX_SMTP_PORT', 587);
        const user = this.configService.get<string>('PONTIFEX_SMTP_USER');
        const pass = this.configService.get<string>('PONTIFEX_SMTP_PASS');
        const from = this.configService.get<string>('PONTIFEX_SMTP_FROM', 'pontifex@pontifex.localhost');

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: false,
            ...(user && pass ? {auth: {user, pass}} : {}),
            tls: {rejectUnauthorized: false},
        });

        this.logger.log(`Email transport configured: ${host}:${port} (from: ${from})`);
    }

    async send(options: SendEmailOptions): Promise<void> {
        const from = this.configService.get<string>('PONTIFEX_SMTP_FROM', 'pontifex@pontifex.localhost');
        const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

        try {
            const info = await this.transporter.sendMail({
                from,
                to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });
            this.logger.log(`Email sent: ${options.subject} -> ${to} (${info.messageId})`);
        } catch (error) {
            this.logger.error(`Failed to send email: ${options.subject} -> ${to}`, error);
        }
    }
}
