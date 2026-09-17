'use strict';
const { z } = require('zod');

const str = (min, max) => z.string().trim().min(min).max(max);
const money = z.coerce.number().min(0).max(99999999);
const int0 = z.coerce.number().int().min(0);
const id = z.coerce.number().int().positive();

const onlyDigits = (v) => String(v).replace(/\D/g, '');

const cpf = z.string().trim()
  .transform(onlyDigits)
  .refine(v => v.length === 11, 'CPF deve ter 11 dígitos.');

const phone = z.string().trim()
  .transform(onlyDigits)
  .refine(v => v.length >= 10 && v.length <= 11, 'Telefone inválido.');

const email = z.string().trim().toLowerCase().email('E-mail inválido.').max(160);
const password = z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(128);

/* ---------- AUTH ---------- */
const registerSchema = z.object({
  name: str(3, 120),
  email,
  password,
  cpf: cpf.optional(),
  phone: phone.optional(),
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.').optional(),
});

const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const forgotSchema = z.object({ email });
const updateMeSchema = z.object({
  name: str(3, 120).optional(),
  phone: phone.optional(),
  currentPassword: z.string().max(128).optional(),
  newPassword: password.optional(),
}).refine(d => !d.newPassword || d.currentPassword,
  { message: 'Informe a senha atual para trocar a senha.', path: ['currentPassword'] });

/* ---------- EVENTOS ---------- */
const EVENT_STATUS = ['draft', 'upcoming', 'active', 'sold_out', 'closed'];

const eventSchema = z.object({
  name: str(3, 160),
  type: str(2, 80).optional(),
  description: z.string().trim().max(5000).optional(),
  rules: z.string().trim().max(5000).optional(),
  venue: z.string().trim().max(160).optional(),
  eventDate: z.union([z.string().trim().max(30), z.null()]).optional(),
  capacity: int0.default(0),
  bannerUrl: z.string().trim().max(255).optional(),
  status: z.enum(EVENT_STATUS).default('draft'),
  goalAttendance: int0.optional(),
  goalRevenue: money.optional(),
});
const eventUpdateSchema = eventSchema.partial();
const goalsSchema = z.object({
  goalAttendance: int0.optional(),
  goalRevenue: money.optional(),
}).refine(d => d.goalAttendance !== undefined || d.goalRevenue !== undefined,
  { message: 'Informe ao menos uma meta.' });

/* ---------- LOTES ---------- */
const batchSchema = z.object({
  name: str(1, 120),
  price: money,
  quantityTotal: int0,
  quantitySold: int0.optional(),
  salesStart: z.string().trim().max(30).nullish(),
  salesEnd: z.string().trim().max(30).nullish(),
  sortOrder: int0.optional(),
  status: z.enum(['active', 'paused', 'closed']).default('active'),
});
const batchUpdateSchema = batchSchema.partial();
const batchStockSchema = z.object({
  totalDelta: z.coerce.number().int().optional(),
  soldDelta: z.coerce.number().int().optional(),
}).refine(d => d.totalDelta !== undefined || d.soldDelta !== undefined,
  { message: 'Informe totalDelta ou soldDelta.' });

/* ---------- PEDIDOS ---------- */
const orderSchema = z.object({
  batchId: id,
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  buyerName: str(3, 120),
  buyerEmail: email,
  buyerCpf: cpf,
});

/* ---------- CHECK-IN ---------- */
const checkinSchema = z.object({
  code: z.string().trim().toUpperCase().max(40).optional(),
  eventId: id.optional(),
  guestName: str(2, 120).optional(),
}).refine(d => d.code || (d.eventId && d.guestName),
  { message: 'Informe um código ou (eventId + guestName) para entrada manual.' });

/* ---------- FINANCEIRO ---------- */
const expenseSchema = z.object({
  categoryId: id.optional(),
  categoryName: str(2, 80).optional(),
  categoryIcon: z.string().trim().max(8).optional(),
  eventId: id.nullish(),
  description: z.string().trim().max(255).optional(),
  amount: money,
  expenseDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pending', 'paid']).default('paid'),
}).refine(d => d.categoryId || d.categoryName,
  { message: 'Informe a categoria da despesa.', path: ['categoryId'] });
const expenseUpdateSchema = expenseSchema.innerType().partial();

/* ---------- ESTOQUE ---------- */
const productSchema = z.object({
  name: str(2, 120),
  emoji: z.string().trim().max(8).optional(),
  category: str(2, 60).default('Outros'),
  unitCost: money.default(0),
  salePrice: money.nullish(),
  stockQuantity: z.coerce.number().int().default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'archived']).default('active'),
});
const productUpdateSchema = productSchema.partial();
const movementSchema = z.object({
  type: z.enum(['in', 'out', 'sale', 'loss', 'adjust']),
  quantity: z.coerce.number().int().refine(v => v !== 0, 'Quantidade não pode ser zero.'),
  unitValue: money.optional(),
  eventId: id.nullish(),
  reason: z.string().trim().max(255).optional(),
});

/* ---------- CONTATOS ---------- */
const contactSchema = z.object({
  name: str(2, 120),
  roleTitle: z.string().trim().max(120).optional(),
  email: z.union([email, z.literal('')]).optional(),
  phone: z.string().trim().max(20).optional(),
  category: str(2, 60).default('Outros'),
  fee: money.default(0),
  notes: z.string().trim().max(2000).optional(),
});
const contactUpdateSchema = contactSchema.partial();

/* ---------- EQUIPE ---------- */
const ORG_ROLES = ['owner', 'admin', 'finance', 'gate', 'bar'];
const teamCreateSchema = z.object({
  name: str(3, 120),
  email,
  password: password.optional(),
  role: z.enum(ORG_ROLES).default('gate'),
  status: z.enum(['active', 'inactive']).default('active'),
});
const teamUpdateSchema = z.object({
  role: z.enum(ORG_ROLES).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/* ---------- PARTICIPANTES ---------- */
const participantStatusSchema = z.object({ status: z.enum(['active', 'blocked']) });

/* ---------- COMUNS ---------- */
const idParam = z.object({ id });
const listQuery = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  eventId: id.optional(),
  status: z.string().trim().max(30).optional(),
});
const unitEconQuery = z.object({
  cac: z.coerce.number().min(0).default(850),
  churn: z.coerce.number().min(0.1).max(100).default(4),
  take: z.coerce.number().min(0).max(100).default(6),
});

module.exports = {
  registerSchema, loginSchema, refreshSchema, forgotSchema, updateMeSchema,
  eventSchema, eventUpdateSchema, goalsSchema,
  batchSchema, batchUpdateSchema, batchStockSchema,
  orderSchema, checkinSchema,
  expenseSchema, expenseUpdateSchema,
  productSchema, productUpdateSchema, movementSchema,
  contactSchema, contactUpdateSchema,
  teamCreateSchema, teamUpdateSchema, participantStatusSchema,
  idParam, listQuery, unitEconQuery,
};
