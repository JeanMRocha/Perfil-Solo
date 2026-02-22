import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Divider,
  Group,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import {
  IconApi,
  IconCheck,
  IconCopy,
  IconCurrencyDollar,
  IconLock,
  IconPlugConnected,
  IconServer,
} from '@tabler/icons-react';
import PageHeader from '../../components/PageHeader';

type ApiParamDoc = {
  name: string;
  type: string;
  required: string;
  description: string;
};

type ApiEndpointDoc = {
  method: 'GET' | 'POST';
  path: string;
  release: 'MVP' | 'Próximo ciclo';
  description: string;
  creditsPerRequest: number;
  params: ApiParamDoc[];
  responseExample: string;
};

const API_BASE_URL = 'https://api.perfilsolo.com/v1';
const AUTH_HEADER = 'Authorization: Bearer <API_KEY>';

const curlExample = `curl -X GET "${API_BASE_URL}/propriedades?limit=20" \\
  -H "${AUTH_HEADER}" \\
  -H "Content-Type: application/json"`;

const jsExample = `const response = await fetch("${API_BASE_URL}/analises", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer <API_KEY>"
  },
  body: JSON.stringify({
    propriedade_id: "prop_01",
    talhao_id: "talhao_03",
    ph: 5.3,
    p_mg_dm3: 11.2
  })
});

const data = await response.json();`;

const endpointRows: ApiEndpointDoc[] = [
  {
    method: 'GET',
    path: '/propriedades',
    release: 'MVP',
    description: 'Lista propriedades vinculadas ao usuário autenticado.',
    creditsPerRequest: 1,
    params: [
      { name: 'limit', type: 'number', required: 'nao', description: 'Quantidade maxima por pagina.' },
      { name: 'cursor', type: 'string', required: 'nao', description: 'Cursor para paginacao.' },
    ],
    responseExample: `{
  "data": [
    { "id": "prop_01", "nome": "Fazenda Modelo" }
  ],
  "next_cursor": null
}`,
  },
  {
    method: 'GET',
    path: '/talhoes',
    release: 'MVP',
    description: 'Retorna talhões com filtro opcional por propriedade.',
    creditsPerRequest: 1,
    params: [
      { name: 'propriedade_id', type: 'string', required: 'nao', description: 'Filtra por propriedade.' },
      { name: 'limit', type: 'number', required: 'nao', description: 'Quantidade maxima por pagina.' },
    ],
    responseExample: `{
  "data": [
    { "id": "talhao_01", "nome": "Talhão Norte", "propriedade_id": "prop_01" }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/analises',
    release: 'Próximo ciclo',
    description: 'Envia análises para processamento e armazenamento.',
    creditsPerRequest: 3,
    params: [
      { name: 'propriedade_id', type: 'string', required: 'sim', description: 'ID da propriedade.' },
      { name: 'talhao_id', type: 'string', required: 'sim', description: 'ID do talhão.' },
      { name: 'ph', type: 'number', required: 'sim', description: 'Valor de pH da amostra.' },
      { name: 'p_mg_dm3', type: 'number', required: 'sim', description: 'Fosforo em mg/dm3.' },
    ],
    responseExample: `{
  "id": "an_9830",
  "status": "queued",
  "message": "Análise recebida para processamento."
}`,
  },
];

const monetizationRows = [
  {
    plan: 'Starter API',
    volume: 'ate 5.000 req/mes',
    monthlyPrice: 'R$ 79',
    excess: 'R$ 0,03 por requisicao',
  },
  {
    plan: 'Growth API',
    volume: 'ate 30.000 req/mes',
    monthlyPrice: 'R$ 299',
    excess: 'R$ 0,02 por requisicao',
  },
  {
    plan: 'Enterprise API',
    volume: 'acima de 30.000 req/mes',
    monthlyPrice: 'Sob consulta',
    excess: 'Negociado por contrato',
  },
];

function methodColor(method: ApiEndpointDoc['method']): string {
  return method === 'GET' ? 'teal' : 'blue';
}

function CodeBlock({ code }: { code: string }) {
  return (
    <Text
      component="pre"
      ff="monospace"
      size="xs"
      style={{
        margin: 0,
        padding: '12px',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        background: '#f8fafc',
        overflowX: 'auto',
      }}
    >
      {code}
    </Text>
  );
}

export default function ApiMode() {
  return (
    <Stack>
      <PageHeader title="Modo API" color="blue" />

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconApi size={20} />
            <Title order={4}>Documentacao API</Title>
          </Group>
          <Group gap="xs">
            <Badge color="blue" variant="light">
              Beta
            </Badge>
            <Badge color="gray" variant="outline">
              Docs v0.1
            </Badge>
          </Group>
        </Group>

        <Text c="dimmed" size="sm">
          Base inicial de documentacao para integracao externa. O foco agora e
          registrar contrato tecnico e modelo de cobranca por requisicao.
        </Text>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Tabs defaultValue="overview" variant="outline">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconServer size={14} />}>
              Visao geral
            </Tabs.Tab>
            <Tabs.Tab value="endpoints" leftSection={<IconApi size={14} />}>
              Endpoints
            </Tabs.Tab>
            <Tabs.Tab value="examples" leftSection={<IconPlugConnected size={14} />}>
              Exemplos
            </Tabs.Tab>
            <Tabs.Tab value="pricing" leftSection={<IconCurrencyDollar size={14} />}>
              Monetizacao
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Stack gap="sm">
              <Alert color="blue" variant="light" title="Publicacao">
                API ainda em preparacao. Esta documentacao define o contrato minimo.
              </Alert>

              <Group justify="space-between" align="end">
                <div>
                  <Text fw={700} size="sm">
                    Base URL
                  </Text>
                  <Text ff="monospace" size="sm">
                    {API_BASE_URL}
                  </Text>
                </div>
                <CopyButton value={API_BASE_URL}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="light"
                      color={copied ? 'teal' : 'gray'}
                      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={copy}
                    >
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  )}
                </CopyButton>
              </Group>

              <Divider />

              <Group justify="space-between" align="end">
                <div>
                  <Text fw={700} size="sm">
                    Header de autenticacao
                  </Text>
                  <Text ff="monospace" size="sm">
                    {AUTH_HEADER}
                  </Text>
                </div>
                <CopyButton value={AUTH_HEADER}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="light"
                      color={copied ? 'teal' : 'gray'}
                      leftSection={copied ? <IconCheck size={14} /> : <IconLock size={14} />}
                      onClick={copy}
                    >
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  )}
                </CopyButton>
              </Group>

              <Text c="dimmed" size="sm">
                Escopo inicial: propriedades, talhoes e analises. Cada chamada consome
                creditos de API conforme a complexidade do endpoint.
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="endpoints" pt="md">
            <Accordion chevronPosition="left" variant="contained">
              {endpointRows.map((endpoint) => (
                <Accordion.Item key={`${endpoint.method}-${endpoint.path}`} value={`${endpoint.method}-${endpoint.path}`}>
                  <Accordion.Control>
                    <Group gap="xs" wrap="nowrap">
                      <Badge color={methodColor(endpoint.method)}>{endpoint.method}</Badge>
                      <Text ff="monospace" size="sm">
                        {endpoint.path}
                      </Text>
                      <Badge variant="outline" color="gray">
                        {endpoint.release}
                      </Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Text size="sm" c="dimmed">
                        {endpoint.description}
                      </Text>
                      <Text size="sm">
                        Creditos por requisicao: <b>{endpoint.creditsPerRequest}</b>
                      </Text>

                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Parametro</Table.Th>
                            <Table.Th>Tipo</Table.Th>
                            <Table.Th>Obrigatorio</Table.Th>
                            <Table.Th>Descricao</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {endpoint.params.map((param) => (
                            <Table.Tr key={`${endpoint.path}-${param.name}`}>
                              <Table.Td>
                                <Text ff="monospace" size="sm">
                                  {param.name}
                                </Text>
                              </Table.Td>
                              <Table.Td>{param.type}</Table.Td>
                              <Table.Td>{param.required}</Table.Td>
                              <Table.Td>{param.description}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>

                      <Text fw={700} size="sm">
                        Exemplo de resposta
                      </Text>
                      <CodeBlock code={endpoint.responseExample} />
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Tabs.Panel>

          <Tabs.Panel value="examples" pt="md">
            <Stack gap="md">
              <div>
                <Text fw={700} size="sm" mb={6}>
                  Requisicao cURL
                </Text>
                <CodeBlock code={curlExample} />
              </div>
              <div>
                <Text fw={700} size="sm" mb={6}>
                  Requisicao JavaScript (fetch)
                </Text>
                <CodeBlock code={jsExample} />
              </div>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="pricing" pt="md">
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Estrutura inicial para venda de funcionalidades por volume de requisicoes.
                Os valores abaixo sao referencia interna e podem ser ajustados.
              </Text>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Plano</Table.Th>
                    <Table.Th>Volume incluido</Table.Th>
                    <Table.Th>Valor mensal</Table.Th>
                    <Table.Th>Excedente</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {monetizationRows.map((row) => (
                    <Table.Tr key={row.plan}>
                      <Table.Td>{row.plan}</Table.Td>
                      <Table.Td>{row.volume}</Table.Td>
                      <Table.Td>{row.monthlyPrice}</Table.Td>
                      <Table.Td>{row.excess}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="flex-end">
                <Button variant="light" leftSection={<IconPlugConnected size={16} />} disabled>
                  Liberar chave de API (em breve)
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Stack>
  );
}
