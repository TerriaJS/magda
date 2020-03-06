import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
export { Attachment } from "nodemailer/lib/mailer";

export interface SMTPMailer {
    send(msg: Message): Promise<{}>;
    checkConnectivity(): Promise<void>;
}

export interface SMTPMailerOptions {
    smtpHostname: string;
    smtpUsername?: string;
    smtpPassword?: string;
    smtpPort: number;
    smtpSecure: boolean;
}

export type Message = SMTPTransport.Options;

export class NodeMailerSMTPMailer implements SMTPMailer {
    constructor(readonly opts: SMTPMailerOptions) {}

    private connect(): Promise<nodemailer.Transporter> {
        const options: SMTPTransport.Options = {
            host: this.opts.smtpHostname,
            port: this.opts.smtpPort,
            requireTLS: this.opts.smtpSecure,
            logger: false,
            debug: false,
            connectionTimeout: 1500,
            auth: {
                user: this.opts.smtpUsername,
                pass: this.opts.smtpPassword
            }
        };

        const transporter = nodemailer.createTransport(options);

        return new Promise((resolve, reject) => {
            transporter.verify((err, success) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    resolve(transporter);
                }
            });
        });
    }

    checkConnectivity() {
        return this.connect().then(transporter => {
            transporter.close();
        });
    }

    send(msg: SMTPTransport.Options) {
        return this.connect().then(
            transporter =>
                new Promise((resolve, reject) => {
                    transporter.sendMail(msg, (err, info) => {
                        if (err) {
                            console.error(err);
                            transporter.close();
                            reject(err);
                        } else {
                            transporter.close();
                            resolve(info);
                        }
                    });
                })
        );
    }
}
