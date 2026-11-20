'use strict';
/**
 * Script utilitário para validar o envio de e-mails transacionais via Resend.
 * Uso:
 *   node src/scripts/testEmailSend.js [destinatario@dominio.com] [tipo: welcome|reset|order]
 * Exemplo:
 *   node src/scripts/testEmailSend.js seu-email@exemplo.com welcome
 */

const env = require('../config/env');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

async function main() {
  const args = process.argv.slice(2);
  const targetEmail = args[0];
  const emailType = (args[1] || 'welcome').toLowerCase();

  if (!targetEmail) {
    console.log(`
Uso: node src/scripts/testEmailSend.js <destinatario> [tipo]

Parâmetros:
  destinatario   E-mail de destino (atenção: em contas gratuitas do Resend sem domínio próprio,
                 o destinatário deve ser o e-mail cadastrado na conta do Resend).
  tipo           welcome | reset | order (padrão: welcome)

Exemplos:
  node src/scripts/testEmailSend.js meu-email@gmail.com welcome
  node src/scripts/testEmailSend.js meu-email@gmail.com reset
  node src/scripts/testEmailSend.js meu-email@gmail.com order
`);
    process.exit(1);
  }

  console.log('--- TESTE OPERACIONAL DE ENVIO VIA RESEND ---');
  console.log(`Destinatário : ${emailService.maskEmail(targetEmail)}`);
  console.log(`Tipo         : ${emailType}`);
  console.log(`Remetente    : ${env.email.from}`);
  console.log(`Frontend URL : ${env.frontendUrl}`);
  console.log(`API Key      : ${env.email.resendApiKey ? 'Configurada (***)' : 'NÃO CONFIGURADA'}`);

  if (!env.email.resendApiKey) {
    console.error('\n[AVISO] RESEND_API_KEY ausente no arquivo backend/.env. O envio será apenas simulado.');
  }

  let result;
  if (emailType === 'reset') {
    result = await emailService.sendPasswordResetEmail({
      to: targetEmail,
      name: 'Usuário Teste',
      token: 'demo_token_teste_1234567890abcdef',
      expiresMinutes: 30,
    });
  } else if (emailType === 'order') {
    result = await emailService.sendOrderConfirmationEmail({
      to: targetEmail,
      buyerName: 'Carlos Teste',
      orderId: 1001,
      eventName: 'EvoTech Festival 2026',
      eventDate: new Date(Date.now() + 86400000 * 30),
      venue: 'Arena EvoTech - Curitiba, PR',
      totalAmount: 150.00,
      paymentMethod: 'pix',
      items: [{ batch_name: 'Pista Premium', quantity: 1, unit_price: 150.00 }],
      tickets: [{ code: 'EVO-PISTA-TESTE01', holder_name: 'Carlos Teste', batch_name: 'Pista Premium' }],
    });
  } else {
    result = await emailService.sendWelcomeEmail({
      to: targetEmail,
      name: 'Participante Teste',
    });
  }

  console.log('\n--- RESULTADO DA OPERAÇÃO ---');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n✓ E-mail enviado com sucesso pelo Resend!');
  } else if (result.simulated) {
    console.log('\nℹ E-mail simulado com sucesso (configure RESEND_API_KEY no .env para envio real).');
  } else {
    console.error(`\n✗ Falha no envio: ${result.error}`);
    if (result.error && result.error.includes('testing')) {
      console.error('\nDica: No plano gratuito sem domínio verificado, o Resend só permite enviar para o e-mail da sua própria conta Resend.');
    }
  }
}

main().catch(err => {
  console.error('Erro inesperado no script de teste:', err);
  process.exit(1);
});
