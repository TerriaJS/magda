import html2text from "html-to-text";

import { Message, SMTPMailer, Attachment } from "./SMTPMailer";
import { DatasetMessage } from "./model";

/**
 *
 * Sends a message.
 *
 * @param mailer The SMTPMailer instance to use to send the message
 * @param defaultRecipient The default recipient email address - used
 *   if overrideSendToDefaultRecipient is true and for the from field
 *   (but not the reply to field)
 * @param input The message to send
 * @param html The HTML content of the message
 * @param subject The subject of the email
 * @param recipient The intended recipient of the email (may be
 *   overridden if overrideSendToDefaultRecipient is true)
 * @param overrideSendToDefaultRecipient "true" to always send to
 *   defaultRecipient instead of recipient, but put a note in the
 *   subject to note who the intended recipient is. Useful for test
 *   environments or if you don't want users to be able to directly
 *   send emails without someone moderating them.
 */
export function sendMail(
    mailer: SMTPMailer,
    defaultRecipient: string,
    input: DatasetMessage,
    html: string,
    attachments: Attachment[],
    subject: string,
    recipient: string,
    overrideSendToDefaultRecipient: boolean = false
): Promise<{}> {
    const overridingRecipientToDefault =
        overrideSendToDefaultRecipient && defaultRecipient !== recipient;
    const to = overridingRecipientToDefault ? defaultRecipient : recipient;
    const finalSubject = overridingRecipientToDefault
        ? `${subject} (for ${recipient})`
        : subject;

    const message: Message = {
        to,
        from: `${input.senderName} via data.gov.au <${defaultRecipient}>`,
        replyTo: `${input.senderName} <${input.senderEmail}>`,
        subject: finalSubject,
        text: html2text.fromString(html),
        html,
        attachments
    };

    console.log(
        `Sending with subject ${subject} from ${input.senderEmail} to ${to}`
    );

    return mailer.send(message);
}
