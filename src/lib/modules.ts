export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
};
export type Module = {
  title: string;
  description: string;
  fields: Field[];
  clinical?: boolean;
};
const name: Field = { key: "name", label: "Nome", required: true };
const status: Field = {
  key: "status",
  label: "Situação",
  options: ["Ativo", "Inativo"],
};
const contact: Field[] = [
  { key: "email", label: "E-mail", type: "email" },
  { key: "phone", label: "Telefone", type: "tel" },
];
export const modules: Record<string, Module> = {
  pacientes: {
    title: "Pacientes",
    description: "Cadastros e contatos dos pacientes da clínica.",
    fields: [
      name,
      ...contact,
      { key: "birth_date", label: "Nascimento", type: "date" },
      status,
    ],
  },
  profissionais: {
    title: "Profissionais",
    description: "Equipe clínica, especialidades e registros profissionais.",
    fields: [
      name,
      ...contact,
      { key: "specialty", label: "Especialidade" },
      { key: "registration", label: "Registro profissional" },
      status,
    ],
  },
  unidades: {
    title: "Unidades",
    description: "Locais de atendimento da organização.",
    fields: [
      name,
      { key: "address", label: "Endereço" },
      { key: "phone", label: "Telefone", type: "tel" },
    ],
  },
  especialidades: {
    title: "Especialidades",
    description: "Especialidades atendidas pela clínica.",
    fields: [name, status],
  },
  servicos: {
    title: "Serviços",
    description: "Catálogo de serviços e valores.",
    fields: [
      name,
      {
        key: "duration",
        label: "Duração em minutos",
        type: "number",
        required: true,
      },
      { key: "amount", label: "Valor (R$)", type: "number" },
      status,
    ],
  },
  convenios: {
    title: "Convênios",
    description: "Operadoras e informações de contato.",
    fields: [name, ...contact, status],
  },
  consultas: {
    title: "Consultas",
    description: "Agendamentos, confirmações e reagendamentos.",
    fields: [
      { key: "patient_id", label: "Paciente", type: "patient", required: true },
      {
        key: "professional_id",
        label: "Profissional",
        type: "professional",
        required: true,
      },
      { key: "service_id", label: "Serviço", type: "service" },
      {
        key: "starts_at",
        label: "Data e horário",
        type: "datetime-local",
        required: true,
      },
      {
        key: "status",
        label: "Situação",
        options: [
          "Agendada",
          "Confirmada",
          "Em espera",
          "Em atendimento",
          "Concluída",
          "Cancelada",
        ],
      },
      { key: "notes", label: "Observações administrativas", type: "textarea" },
    ],
  },
  disponibilidade: {
    title: "Disponibilidade",
    description: "Períodos disponíveis para atendimento.",
    fields: [
      {
        key: "professional_id",
        label: "Profissional",
        type: "professional",
        required: true,
      },
      {
        key: "starts_at",
        label: "Início",
        type: "datetime-local",
        required: true,
      },
      { key: "ends_at", label: "Fim", type: "datetime-local", required: true },
    ],
  },
  pagamentos: {
    title: "Pagamentos",
    description: "Registro de recebimentos da clínica.",
    fields: [
      name,
      { key: "amount", label: "Valor (R$)", type: "number", required: true },
      { key: "date", label: "Data", type: "date", required: true },
      {
        key: "status",
        label: "Situação",
        options: ["Pendente", "Pago", "Cancelado"],
      },
    ],
  },
  "contas-receber": {
    title: "Contas a receber",
    description: "Recebíveis e vencimentos.",
    fields: [
      name,
      { key: "amount", label: "Valor (R$)", type: "number", required: true },
      { key: "date", label: "Vencimento", type: "date", required: true },
      {
        key: "status",
        label: "Situação",
        options: ["Pendente", "Pago", "Cancelado"],
      },
    ],
  },
  "contas-pagar": {
    title: "Contas a pagar",
    description: "Despesas e obrigações financeiras.",
    fields: [
      name,
      { key: "amount", label: "Valor (R$)", type: "number", required: true },
      { key: "date", label: "Vencimento", type: "date", required: true },
      {
        key: "status",
        label: "Situação",
        options: ["Pendente", "Pago", "Cancelado"],
      },
    ],
  },
  prontuario: {
    title: "Prontuário",
    description:
      "Registros clínicos. O acesso depende das permissões no banco.",
    clinical: true,
    fields: [
      { key: "patient_id", label: "Paciente", type: "patient", required: true },
      { key: "date", label: "Data", type: "date", required: true },
      {
        key: "notes",
        label: "Evolução clínica",
        type: "textarea",
        required: true,
      },
    ],
  },
  receitas: {
    title: "Receitas",
    description:
      "Registro de prescrições. A emissão assinada exige integração própria.",
    clinical: true,
    fields: [
      { key: "patient_id", label: "Paciente", type: "patient", required: true },
      { key: "date", label: "Data", type: "date", required: true },
      { key: "notes", label: "Prescrição", type: "textarea", required: true },
    ],
  },
  exames: {
    title: "Exames",
    description: "Solicitações e resultados de exames.",
    clinical: true,
    fields: [
      name,
      { key: "patient_id", label: "Paciente", type: "patient", required: true },
      {
        key: "notes",
        label: "Solicitação ou resultado",
        type: "textarea",
        required: true,
      },
    ],
  },
  atestados: {
    title: "Atestados",
    description:
      "Registros de atestados. A emissão assinada exige integração própria.",
    clinical: true,
    fields: [
      { key: "patient_id", label: "Paciente", type: "patient", required: true },
      { key: "date", label: "Data", type: "date", required: true },
      { key: "notes", label: "Conteúdo", type: "textarea", required: true },
    ],
  },
  documentos: {
    title: "Documentos",
    description:
      "Referências a documentos. Não cadastre links públicos para dados sensíveis.",
    clinical: true,
    fields: [
      name,
      { key: "patient_id", label: "Paciente", type: "patient", required: true },
      {
        key: "notes",
        label: "Referência interna do documento",
        type: "textarea",
        required: true,
      },
      {
        key: "attachment",
        label: "Arquivo privado (PDF, JPEG ou PNG, até 20 MB)",
        type: "file",
      },
    ],
  },
};

// Explicit assignment lets the professional portal display only the responsible professional's records.
Object.values(modules)
  .filter((module) => module.clinical)
  .forEach((module) =>
    module.fields.splice(1, 0, {
      key: "professional_id",
      label: "Profissional responsável",
      type: "professional",
      required: true,
    }),
  );
modules.pagamentos.fields.splice(1, 0, {
  key: "patient_id",
  label: "Paciente (para exibir no portal)",
  type: "patient",
});
