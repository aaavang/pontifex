import { AuthenticatedTemplate, useMsal } from "@azure/msal-react";
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Code,
  Flex,
  Heading,
  HStack,
  IconButton,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

const SAVED_QUERIES_KEY = "pontifex-gremlin-saved-queries";
const QUERY_HISTORY_KEY = "pontifex-gremlin-history";

const PRESET_QUERIES = [
  { label: "All vertices", query: "g.V().limit(50)" },
  { label: "All edges", query: "g.E().limit(50)" },
  { label: "All applications", query: "g.V().has('type', 'application')" },
  { label: "All environments", query: "g.V().has('type', 'environment')" },
  { label: "All groups", query: "g.V().has('type', 'group')" },
  { label: "All users", query: "g.V().has('type', 'user')" },
  { label: "All system settings", query: "g.V().has('type', 'systemSetting')" },
  { label: "All token groups", query: "g.V().has('type', 'tokenGroup')" },
  { label: "Vertex count by type", query: "g.V().groupCount().by('type')" },
  { label: "Edge count by label", query: "g.E().groupCount().by(label)" },
  { label: "All edges (raw)", query: "g.E().limit(100)" },
];

function vertexToNode(v: any) {
  const props = v.properties;
  let type = "unknown";
  let name = String(v.id);

  if (Array.isArray(props)) {
    for (const p of props) {
      if (p.key === "type") type = p.value;
      if (p.key === "name") name = p.value;
    }
  } else if (props) {
    type = props.type?.[0]?.value ?? props.type ?? "unknown";
    name = props.name?.[0]?.value ?? props.name ?? String(v.id);
  }

  return { id: String(v.id), label: name, type };
}

function parseGraphData(vertices: any[], edges: any[]) {
  const nodeMap = new Map<string, any>();

  for (const v of vertices) {
    if (!v?.id) continue;
    const id = String(v.id);
    if (!nodeMap.has(id) && v.properties) {
      nodeMap.set(id, vertexToNode(v));
    }
  }

  const parsedEdges = edges
    .filter((e) => e?.inV !== undefined && e?.outV !== undefined)
    .map((e) => {
      const sourceId = String(typeof e.outV === "object" ? e.outV.id : e.outV);
      const targetId = String(typeof e.inV === "object" ? e.inV.id : e.inV);
      return { source: sourceId, target: targetId, label: e.label };
    })
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target));

  const nodes = Array.from(nodeMap.values());

  // Deduplicate edges by source-label-target
  const edgeKeys = new Set<string>();
  const dedupedEdges = parsedEdges.filter((e) => {
    const key = `${e.source}-${e.label}-${e.target}`;
    if (edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  });

  return { nodes, edges: dedupedEdges };
}

const TYPE_COLORS: Record<string, string> = {
  application: "#4299E1",
  environment: "#48BB78",
  user: "#ED8936",
  group: "#9F7AEA",
  role: "#F56565",
  scope: "#38B2AC",
  systemSetting: "#718096",
  tokenGroup: "#D69E2E",
  event: "#FC8181",
  permissionRequest: "#F687B3",
  unknown: "#A0AEC0",
};

function GraphView({ items }: { items: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  useEffect(() => {
    // Check if items contain vertices (have properties field)
    const vertices = items.filter((i) => i?.id && i?.properties);
    const rawEdges = items.filter((i) => i?.inV !== undefined && i?.outV !== undefined);

    if (vertices.length === 0) return;

    const renderGraph = (nodes: any[], edges: any[]) => {
      import("cytoscape").then((cytoscape) => {
        if (cyRef.current) {
          cyRef.current.destroy();
        }

        const elements: any[] = [
          ...nodes.map((n) => ({
            data: { id: n.id, label: n.label, type: n.type },
          })),
          ...edges.map((e, i) => ({
            data: {
              id: `edge-${i}`,
              source: e.source,
              target: e.target,
              label: e.label,
            },
          })),
        ];

        cyRef.current = cytoscape.default({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: "node",
              style: {
                label: "data(label)",
                "text-valign": "bottom",
                "text-margin-y": 5,
                "font-size": "11px",
                "background-color": (ele: any) =>
                  TYPE_COLORS[ele.data("type")] ?? TYPE_COLORS.unknown,
                width: 30,
                height: 30,
              },
            },
            {
              selector: "edge",
              style: {
                label: "data(label)",
                "font-size": "9px",
                "text-rotation": "autorotate",
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "arrow-scale": 0.8,
                "line-color": "#CBD5E0",
                "target-arrow-color": "#CBD5E0",
                width: 1,
              },
            },
          ],
          layout: {
            name: "cose",
            animate: false,
            nodeDimensionsIncludeLabels: true,
          },
        });
      });
    };

    if (rawEdges.length > 0) {
      // Query returned both vertices and edges
      const { nodes, edges } = parseGraphData(vertices, rawEdges);
      renderGraph(nodes, edges);
    } else {
      // Query returned only vertices — auto-fetch edges between them via graph endpoint
      setGraphLoading(true);
      axios
        .get("/api/admin/graph")
        .then((res) => {
          const allEdges = res.data.edges ?? [];
          const { nodes, edges } = parseGraphData(vertices, allEdges);
          renderGraph(nodes, edges);
        })
        .catch(() => {
          // Fall back to no edges
          const { nodes, edges } = parseGraphData(vertices, []);
          renderGraph(nodes, edges);
        })
        .finally(() => setGraphLoading(false));
    }

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [items]);

  return (
    <Box position="relative">
      {graphLoading && (
        <Text position="absolute" top={2} left={2} fontSize="sm" color="gray.500" zIndex={1}>
          Loading edges...
        </Text>
      )}
      <Box ref={containerRef} w="100%" h="500px" border="1px solid" borderColor="gray.200" borderRadius="md" />
    </Box>
  );
}

function JsonView({ data }: { data: any }) {
  return (
    <Box
      as="pre"
      p={4}
      bg="gray.50"
      borderRadius="md"
      overflow="auto"
      maxH="600px"
      fontSize="sm"
      whiteSpace="pre-wrap"
      wordBreak="break-all"
    >
      {JSON.stringify(data, null, 2)}
    </Box>
  );
}

function PropertyEditor({
  item,
  onSave,
}: {
  item: any;
  onSave: (query: string) => void;
}) {
  const [editableProps, setEditableProps] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!item?.properties) return;
    const props: Record<string, string> = {};
    if (Array.isArray(item.properties)) {
      for (const p of item.properties) {
        props[p.key] = String(p.value);
      }
    } else {
      for (const [k, v] of Object.entries(item.properties)) {
        const val = Array.isArray(v) ? (v as any)[0]?.value : v;
        props[k] = String(val ?? "");
      }
    }
    setEditableProps(props);
  }, [item]);

  if (!item?.id) return null;

  const handleSave = () => {
    const propStatements = Object.entries(editableProps)
      .filter(([k]) => k !== "pk" && k !== "type")
      .map(([k, v]) => `.property('${k}', '${v.replace(/'/g, "\\'")}')`);
    const query = `g.V('${item.id}')${propStatements.join("")}`;
    onSave(query);
  };

  return (
    <Card variant="outline" size="sm">
      <CardHeader pb={2}>
        <Heading size="sm">Edit: {item.id}</Heading>
      </CardHeader>
      <CardBody pt={0}>
        <VStack spacing={2} align="stretch">
          {Object.entries(editableProps).map(([key, value]) => (
            <HStack key={key}>
              <Code minW="120px" fontSize="xs">{key}</Code>
              <Textarea
                size="sm"
                rows={1}
                value={value}
                isReadOnly={key === "pk" || key === "type"}
                onChange={(e) =>
                  setEditableProps({ ...editableProps, [key]: e.target.value })
                }
              />
            </HStack>
          ))}
          <Button size="sm" colorScheme="blue" onClick={handleSave}>
            Generate Update Query
          </Button>
        </VStack>
      </CardBody>
    </Card>
  );
}

const GremlinAdmin = () => {
  const { accounts } = useMsal();
  const roles: string[] = (accounts[0]?.idTokenClaims as any)?.roles ?? [];
  const isAdmin = roles.includes("Admin");

  const [query, setQuery] = useState("g.V().limit(20)");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [history, setHistory] = useState<string[]>([]);
  const toast = useToast();

  if (!isAdmin) {
    return (
      <AuthenticatedTemplate>
        <VStack p={10}>
          <Heading>Access Denied</Heading>
          <Text>You need the Admin role to access the Gremlin Console.</Text>
        </VStack>
      </AuthenticatedTemplate>
    );
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUERY_HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const executeQuery = useCallback(
    async (q?: string) => {
      const queryToRun = q ?? query;
      setLoading(true);
      setError(null);
      setSelectedItem(null);

      try {
        const res = await axios.post("/api/admin/gremlin", {
          query: queryToRun,
        });
        setResults(res.data.items ?? []);

        // Update history
        const newHistory = [
          queryToRun,
          ...history.filter((h) => h !== queryToRun),
        ].slice(0, 50);
        setHistory(newHistory);
        localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(newHistory));
      } catch (err: any) {
        const msg =
          err.response?.data?.message ?? err.message ?? "Query failed";
        setError(msg);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [query, history]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
    }
  };

  return (
    <AuthenticatedTemplate>
      <VStack p={5} spacing={4} align="stretch" maxW="1400px" mx="auto">
        <Heading>Gremlin Console</Heading>

        <Card variant="outline">
          <CardBody>
            <VStack spacing={3} align="stretch">
              <HStack>
                <Select
                  placeholder="Preset queries..."
                  size="sm"
                  maxW="300px"
                  onChange={(e) => {
                    if (e.target.value) setQuery(e.target.value);
                  }}
                >
                  {PRESET_QUERIES.map((pq) => (
                    <option key={pq.label} value={pq.query}>
                      {pq.label}
                    </option>
                  ))}
                </Select>
                {history.length > 0 && (
                  <Select
                    placeholder="History..."
                    size="sm"
                    maxW="400px"
                    onChange={(e) => {
                      if (e.target.value) setQuery(e.target.value);
                    }}
                  >
                    {history.map((h, i) => (
                      <option key={i} value={h}>
                        {h.length > 80 ? h.slice(0, 80) + "..." : h}
                      </option>
                    ))}
                  </Select>
                )}
              </HStack>

              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                fontFamily="mono"
                fontSize="sm"
                rows={4}
                placeholder="Enter a Gremlin query..."
              />

              <HStack>
                <Button
                  colorScheme="green"
                  onClick={() => executeQuery()}
                  isLoading={loading}
                  size="sm"
                >
                  Execute
                </Button>
                <Tooltip label="Cmd/Ctrl + Enter" fontSize="xs">
                  <Text fontSize="xs" color="gray.500">
                    Keyboard shortcut available
                  </Text>
                </Tooltip>
                {results.length > 0 && (
                  <Text fontSize="sm" color="gray.600">
                    {results.length} result{results.length !== 1 ? "s" : ""}
                  </Text>
                )}
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {error && (
          <Card variant="outline" borderColor="red.300">
            <CardBody>
              <Text color="red.500" fontFamily="mono" fontSize="sm">
                {error}
              </Text>
            </CardBody>
          </Card>
        )}

        {results.length > 0 && (
          <Tabs variant="enclosed">
            <TabList>
              <Tab>JSON</Tab>
              <Tab>Graph</Tab>
              <Tab>Table</Tab>
            </TabList>
            <TabPanels>
              <TabPanel p={0} pt={3}>
                <Flex gap={4}>
                  <Box flex={1}>
                    <JsonView data={results} />
                  </Box>
                  {selectedItem && (
                    <Box w="400px">
                      <PropertyEditor
                        item={selectedItem}
                        onSave={(q) => {
                          setQuery(q);
                          toast({
                            title: "Update query generated",
                            description:
                              "Review the query and click Execute to apply.",
                            status: "info",
                            duration: 3000,
                          });
                        }}
                      />
                    </Box>
                  )}
                </Flex>
                {results.some((r) => r?.id) && (
                  <HStack mt={3} flexWrap="wrap" spacing={2}>
                    {results
                      .filter((r) => r?.id)
                      .map((r, i) => {
                        const type =
                          r.properties?.type?.[0]?.value ??
                          r.properties?.type ??
                          "unknown";
                        return (
                          <Button
                            key={i}
                            size="xs"
                            variant={
                              selectedItem?.id === r.id ? "solid" : "outline"
                            }
                            colorScheme="blue"
                            onClick={() => setSelectedItem(r)}
                          >
                            {String(r.id).slice(0, 20)}
                            {String(r.id).length > 20 ? "..." : ""} ({type})
                          </Button>
                        );
                      })}
                  </HStack>
                )}
              </TabPanel>
              <TabPanel p={0} pt={3}>
                <GraphView items={results} />
                <HStack mt={2} flexWrap="wrap" spacing={2}>
                  {Object.entries(TYPE_COLORS).map(([type, color]) => (
                    <HStack key={type} spacing={1}>
                      <Box w="12px" h="12px" borderRadius="full" bg={color} />
                      <Text fontSize="xs">{type}</Text>
                    </HStack>
                  ))}
                </HStack>
              </TabPanel>
              <TabPanel p={0} pt={3}>
                <Box overflow="auto" maxH="600px">
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                    }}
                  >
                    <thead>
                      <tr>
                        {results[0] &&
                          typeof results[0] === "object" &&
                          Object.keys(results[0]).map((key) => (
                            <th
                              key={key}
                              style={{
                                textAlign: "left",
                                padding: "6px 8px",
                                borderBottom: "2px solid #E2E8F0",
                                fontWeight: 600,
                              }}
                            >
                              {key}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, i) => (
                        <tr
                          key={i}
                          style={{
                            cursor: row?.id ? "pointer" : "default",
                            background:
                              selectedItem?.id === row?.id
                                ? "#EBF8FF"
                                : "transparent",
                          }}
                          onClick={() => row?.id && setSelectedItem(row)}
                        >
                          {typeof row === "object" &&
                            Object.values(row).map((val, j) => (
                              <td
                                key={j}
                                style={{
                                  padding: "4px 8px",
                                  borderBottom: "1px solid #E2E8F0",
                                  maxWidth: "300px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {typeof val === "object"
                                  ? JSON.stringify(val)
                                  : String(val ?? "")}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>
        )}
      </VStack>
    </AuthenticatedTemplate>
  );
};

export default GremlinAdmin;
