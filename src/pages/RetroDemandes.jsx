/**
 * Page RétroDemandes unifiée
 * - Onglet "RétroDemande" : pour TOUS (clients/partenaires/adhérents)
 * - Onglet "Récapitulatif" : pour ADHÉRENTS avec rôle PRÉSIDENT, VICE-PRÉSIDENT ou TRÉSORIER
 * - Style cohérent avec Finance
 * - Optimisée pour mobile
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Card,
  CardHeader,
  CardBody,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Spinner,
  Flex,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Icon,
  IconButton,
  Divider,
  Grid,
  useBreakpointValue,
  SimpleGrid
} from "@chakra-ui/react";
import {
  DeleteIcon,
  EditIcon,
  ViewIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon
} from "@chakra-ui/icons";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiDownload,
  FiFileText
} from "react-icons/fi";
import WorkspaceLayout from "../components/Layout/WorkspaceLayout";
import { apiClient } from "../api/config";
import { useUser } from "../context/UserContext";

const RetroDemandes = () => {
  const toast = useToast();
  const { user } = useUser();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isPreviewOpen, onOpen: onPreviewOpen, onClose: onPreviewClose } = useDisclosure();
  
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "NORMAL"
  });

  // Vérifier si l'utilisateur peut accéder à l'onglet Récapitulatif
  const canViewRecap = useCallback(() => {
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const hasAdminRole = roles.some(r => 
      r === "ADMIN" || r === "PRESIDENT" || r === "VICE-PRESIDENT" || r === "TREASURER"
    );
    return hasAdminRole;
  }, [user]);

  // Charger les demandes de l'utilisateur
  const loadMyRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/api/retro-requests");
      if (response.requests) {
        setRequests(response.requests);
      }
    } catch (error) {
      console.error("Erreur chargement mes demandes:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos demandes",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Charger toutes les demandes (pour récapitulatif)
  const loadAllRequests = useCallback(async () => {
    if (!canViewRecap()) return;
    try {
      setLoading(true);
      const response = await apiClient.get("/api/retro-requests/admin/all");
      if (response.requests) {
        setAllRequests(response.requests);
      }
    } catch (error) {
      console.error("Erreur chargement toutes les demandes:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger toutes les demandes",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  }, [canViewRecap, toast]);

  useEffect(() => {
    loadMyRequests();
    if (canViewRecap()) {
      loadAllRequests();
    }
  }, [loadMyRequests, loadAllRequests, canViewRecap]);

  // Créer une nouvelle demande
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast({
        title: "Erreur",
        description: "Le titre et la description sont obligatoires",
        status: "warning"
      });
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        await apiClient.put(`/api/retro-requests/${editingId}`, formData);
        toast({
          title: "Succès",
          description: "Demande modifiée",
          status: "success"
        });
      } else {
        await apiClient.post("/api/retro-requests", formData);
        toast({
          title: "Succès",
          description: "Demande créée",
          status: "success"
        });
      }
      
      setFormData({ title: "", description: "", category: "GENERAL", priority: "NORMAL" });
      setEditingId(null);
      onClose();
      await loadMyRequests();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la demande",
        status: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({ title: "", description: "", category: "GENERAL", priority: "NORMAL" });
    onOpen();
  };

  const handleEdit = (request) => {
    setEditingId(request.id);
    setFormData({
      title: request.title,
      description: request.description,
      category: request.category,
      priority: request.priority
    });
    onOpen();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette demande ?")) return;
    
    try {
      setLoading(true);
      await apiClient.delete(`/api/retro-requests/${id}`);
      toast({
        title: "Succès",
        description: "Demande supprimée",
        status: "success"
      });
      await loadMyRequests();
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la demande",
        status: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    onPreviewOpen();
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING: { label: "⏳ En attente", color: "orange" },
      APPROVED: { label: "✅ Approuvée", color: "green" },
      REJECTED: { label: "❌ Refusée", color: "red" },
      PROCESSING: { label: "🔄 En traitement", color: "blue" }
    };
    const s = statusMap[status] || { label: status, color: "gray" };
    return <Badge colorScheme={s.color}>{s.label}</Badge>;
  };

  const categoryLabel = (cat) => {
    const cats = {
      GENERAL: "Général",
      REPAIR: "Réparation",
      MAINTENANCE: "Maintenance",
      SERVICE: "Service",
      CUSTOM: "Personnalisé"
    };
    return cats[cat] || cat;
  };

  const isMobile = useBreakpointValue({ base: true, md: false });
  const tableSize = isMobile ? "sm" : "md";

  const renderRetroDemandesSection = () => (
    <VStack align="stretch" spacing={6}>
      <Card>
          <CardHeader pb={0}>
            <Tabs index={tabIndex} onChange={setTabIndex} variant="enclosed">
              <TabList>
                <Tab>
                  <Icon as={FiFileText} mr={2} />
                  RétroDemande
                </Tab>
                {canViewRecap() && (
                  <Tab>
                    <Icon as={FiDownload} mr={2} />
                    Récapitulatif
                  </Tab>
                )}
              </TabList>

              <TabPanels>
                {/* ONGLET 1: MES DEMANDES */}
                <TabPanel>
                  <Box pt={4}>
                    {loading && requests.length === 0 ? (
                      <Flex justify="center" py={10}>
                        <Spinner />
                      </Flex>
                    ) : requests.length === 0 ? (
                      <Box textAlign="center" py={10} color="gray.500">
                        <Text mb={4}>Aucune demande pour le moment</Text>
                        <Button
                          colorScheme="blue"
                          size="sm"
                          leftIcon={<FiPlus />}
                          onClick={handleNew}
                        >
                          Créer une demande
                        </Button>
                      </Box>
                    ) : isMobile ? (
                      // Vue mobile : Cards
                      <SimpleGrid spacing={4} columns={1}>
                        {requests.map((req) => (
                          <Card key={req.id} variant="outline">
                            <CardBody>
                              <VStack align="start" spacing={3}>
                                <HStack justify="space-between" width="100%">
                                  <Heading size="sm">{req.title}</Heading>
                                  {getStatusBadge(req.status)}
                                </HStack>
                                <Text fontSize="sm" color="gray.600">
                                  {req.description}
                                </Text>
                                <HStack spacing={2} fontSize="xs" color="gray.500">
                                  <Badge>{categoryLabel(req.category)}</Badge>
                                  <Text>
                                    {new Date(req.createdAt).toLocaleDateString()}
                                  </Text>
                                </HStack>
                                <HStack spacing={2} width="100%" pt={2}>
                                  <IconButton
                                    icon={<ViewIcon />}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleViewDetails(req)}
                                    title="Voir détails"
                                  />
                                  {req.status === "PENDING" && (
                                    <>
                                      <IconButton
                                        icon={<EditIcon />}
                                        size="sm"
                                        variant="ghost"
                                        colorScheme="blue"
                                        onClick={() => handleEdit(req)}
                                        title="Éditer"
                                      />
                                      <IconButton
                                        icon={<DeleteIcon />}
                                        size="sm"
                                        variant="ghost"
                                        colorScheme="red"
                                        onClick={() => handleDelete(req.id)}
                                        title="Supprimer"
                                      />
                                    </>
                                  )}
                                </HStack>
                              </VStack>
                            </CardBody>
                          </Card>
                        ))}
                      </SimpleGrid>
                    ) : (
                      // Vue desktop : Table
                      <Box overflowX="auto">
                        <Table size={tableSize} variant="striped">
                          <Thead>
                            <Tr>
                              <Th>Titre</Th>
                              <Th>Catégorie</Th>
                              <Th>Priorité</Th>
                              <Th>Statut</Th>
                              <Th>Date</Th>
                              <Th>Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {requests.map((req) => (
                              <Tr key={req.id}>
                                <Td fontWeight="medium">{req.title}</Td>
                                <Td fontSize="sm">{categoryLabel(req.category)}</Td>
                                <Td>
                                  <Badge
                                    colorScheme={
                                      req.priority === "URGENT"
                                        ? "red"
                                        : req.priority === "HIGH"
                                        ? "orange"
                                        : req.priority === "NORMAL"
                                        ? "blue"
                                        : "gray"
                                    }
                                  >
                                    {req.priority}
                                  </Badge>
                                </Td>
                                <Td>{getStatusBadge(req.status)}</Td>
                                <Td fontSize="sm">
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </Td>
                                <Td>
                                  <HStack spacing={2}>
                                    <IconButton
                                      icon={<ViewIcon />}
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleViewDetails(req)}
                                      title="Voir détails"
                                    />
                                    {req.status === "PENDING" && (
                                      <>
                                        <IconButton
                                          icon={<EditIcon />}
                                          size="sm"
                                          variant="ghost"
                                          colorScheme="blue"
                                          onClick={() => handleEdit(req)}
                                          title="Éditer"
                                        />
                                        <IconButton
                                          icon={<DeleteIcon />}
                                          size="sm"
                                          variant="ghost"
                                          colorScheme="red"
                                          onClick={() => handleDelete(req.id)}
                                          title="Supprimer"
                                        />
                                      </>
                                    )}
                                  </HStack>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    )}
                  </Box>
                </TabPanel>

                {/* ONGLET 2: RÉCAPITULATIF (Admin only) */}
                {canViewRecap() && (
                  <TabPanel>
                    <Box pt={4}>
                      {loading && allRequests.length === 0 ? (
                        <Flex justify="center" py={10}>
                          <Spinner />
                        </Flex>
                      ) : allRequests.length === 0 ? (
                        <Box textAlign="center" py={10} color="gray.500">
                          <Text>Aucune demande</Text>
                        </Box>
                      ) : isMobile ? (
                        // Vue mobile : Cards
                        <SimpleGrid spacing={4} columns={1}>
                          {allRequests.map((req) => (
                            <Card key={req.id} variant="outline">
                              <CardBody>
                                <VStack align="start" spacing={3}>
                                  <HStack justify="space-between" width="100%">
                                    <Heading size="sm">{req.title}</Heading>
                                    {getStatusBadge(req.status)}
                                  </HStack>
                                  <Text fontSize="sm" color="gray.600">
                                    {req.user?.name || "Anonyme"}
                                  </Text>
                                  <HStack spacing={2} fontSize="xs" color="gray.500">
                                    <Badge>{categoryLabel(req.category)}</Badge>
                                    <Text>
                                      {new Date(req.createdAt).toLocaleDateString()}
                                    </Text>
                                  </HStack>
                                </VStack>
                              </CardBody>
                            </Card>
                          ))}
                        </SimpleGrid>
                      ) : (
                        // Vue desktop : Table
                        <Box overflowX="auto">
                          <Table size={tableSize} variant="striped">
                            <Thead>
                              <Tr>
                                <Th>Titre</Th>
                                <Th>Utilisateur</Th>
                                <Th>Catégorie</Th>
                                <Th>Priorité</Th>
                                <Th>Statut</Th>
                                <Th>Date</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {allRequests.map((req) => (
                                <Tr key={req.id}>
                                  <Td fontWeight="medium">{req.title}</Td>
                                  <Td fontSize="sm">{req.user?.name || "Anonyme"}</Td>
                                  <Td fontSize="sm">
                                    {categoryLabel(req.category)}
                                  </Td>
                                  <Td>
                                    <Badge
                                      colorScheme={
                                        req.priority === "URGENT"
                                          ? "red"
                                          : req.priority === "HIGH"
                                          ? "orange"
                                          : req.priority === "NORMAL"
                                          ? "blue"
                                          : "gray"
                                      }
                                    >
                                      {req.priority}
                                    </Badge>
                                  </Td>
                                  <Td>{getStatusBadge(req.status)}</Td>
                                  <Td fontSize="sm">
                                    {new Date(req.createdAt).toLocaleDateString()}
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Box>
                      )}
                    </Box>
                  </TabPanel>
                )}
              </TabPanels>
            </Tabs>
          </CardHeader>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size={isMobile ? "full" : "2xl"}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingId ? "Modifier la demande" : "Nouvelle demande"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} as="form" onSubmit={handleSubmit}>
              <FormControl isRequired>
                <FormLabel>Titre</FormLabel>
                <Input
                  placeholder="Titre de la demande"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Description</FormLabel>
                <Textarea
                  placeholder="Détails de votre demande"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                />
              </FormControl>

              <Grid templateColumns="1fr 1fr" gap={4} width="100%">
                <FormControl>
                  <FormLabel>Catégorie</FormLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  >
                    <option value="GENERAL">Général</option>
                    <option value="REPAIR">Réparation</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="SERVICE">Service</option>
                    <option value="CUSTOM">Personnalisé</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Priorité</FormLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                  >
                    <option value="LOW">Basse</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">Élevée</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                </FormControl>
              </Grid>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSubmit}
                isLoading={loading}
              >
                {editingId ? "Modifier" : "Créer"}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isPreviewOpen} onClose={onPreviewClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Détails de la demande</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedRequest && (
              <VStack spacing={4} align="start" width="100%">
                <Box>
                  <Text fontWeight="bold">Titre:</Text>
                  <Text>{selectedRequest.title}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Description:</Text>
                  <Text whiteSpace="pre-wrap" fontSize="sm">
                    {selectedRequest.description}
                  </Text>
                </Box>
                <Divider />
                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} width="100%">
                  <Box>
                    <Text fontWeight="bold" fontSize="sm">
                      Catégorie:
                    </Text>
                    <Text>{categoryLabel(selectedRequest.category)}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" fontSize="sm">
                      Priorité:
                    </Text>
                    <Text>{selectedRequest.priority}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" fontSize="sm">
                      Statut:
                    </Text>
                    {getStatusBadge(selectedRequest.status)}
                  </Box>
                  <Box>
                    <Text fontWeight="bold" fontSize="sm">
                      Date:
                    </Text>
                    <Text>
                      {new Date(selectedRequest.createdAt).toLocaleDateString()}
                    </Text>
                  </Box>
                </SimpleGrid>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );

  return (
    <WorkspaceLayout
      title="RétroDemandes"
      subtitle="Gestion de vos demandes et suivi global"
      sections={[{ id: "requests", label: "Demandes", icon: FiFileText, render: renderRetroDemandesSection }]}
      defaultSectionId="requests"
      sidebarTitle="RétroDemandes"
      sidebarSubtitle="Support & demandes"
      sidebarTitleIcon={FiFileText}
      versionLabel="RétroDemandes v2"
      headerActions={[
        <Button key="new" leftIcon={<FiPlus />} colorScheme="blue" onClick={handleNew} size={isMobile ? "sm" : "md"}>
          Nouvelle demande
        </Button>
      ]}
    />
  );
};

export default RetroDemandes;
