import React, { useState, useEffect } from 'react';
import {
  Box, VStack, HStack, Text, Button, Card, CardBody, CardHeader,
  Heading, Input, Textarea, FormControl, FormLabel, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter,
  ModalBody, ModalCloseButton, useDisclosure, Badge, IconButton,
  Flex, Spacer, Alert, AlertIcon, Spinner, Center,
  Select, Switch, Table, Thead, Tbody, Tr, Th, Td, InputGroup,
  InputLeftElement, Menu, MenuButton, MenuList, MenuItem,
  useColorModeValue, Tooltip, Divider, SimpleGrid, Image as ChakraImage,
  Container, Checkbox
} from '@chakra-ui/react';
import { 
  FiEdit, FiTrash2, FiPlus, FiUsers, FiSettings, FiGlobe, FiMail,
  FiShare, FiChevronLeft, FiChevronRight, FiArrowUpRight, FiSearch,
  FiRefreshCw, FiShield, FiLock, FiUnlock, FiActivity, FiEdit2,
  FiAlertCircle
} from 'react-icons/fi';
import { FaEdit, FaTrash, FaPlus, FaEye } from 'react-icons/fa';

import WorkspaceLayout from '../components/Layout/WorkspaceLayout';
import { apiClient } from '../api/config';
import { API_BASE_URL } from '../api/config';
import { displayNameFromUser, formatMemberLabel } from '../lib/names';
import { useUser } from '../context/UserContext';
import EmailTemplateManager from '../components/EmailTemplateManager';
import TemplateManagement from '../components/TemplateManagement';

// === ADMIN ROLES ===
const ADMIN_ROLES = ['ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERAL'];

// === RESOURCES & PERMISSIONS ===
const RESOURCE_CATEGORIES = {
  VEHICLES: {
    label: '🚗 Véhicules',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  FINANCE: {
    label: '💰 Finances',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer transactions',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  EVENTS: {
    label: '📅 Événements',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  STOCK: {
    label: '📦 Stock',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Ajouter articles',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  PLANNING: {
    label: '📊 Planning',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Créer',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
  MEMBERS: {
    label: '👥 Membres',
    permissions: {
      READ: 'Consulter',
      CREATE: 'Ajouter',
      EDIT: 'Modifier',
      DELETE: 'Supprimer',
    }
  },
};

const getRoleColor = (role) => {
  const colors = {
    ADMIN: 'red',
    PRESIDENT: 'purple',
    VICE_PRESIDENT: 'indigo',
    TRESORIER: 'blue',
    SECRETAIRE_GENERAL: 'cyan',
    MEMBER: 'gray',
  };
  return colors[role] || 'gray';
};

const getRoleLabel = (role) => {
  const labels = {
    ADMIN: '🔴 Admin',
    PRESIDENT: '👑 Président',
    VICE_PRESIDENT: '👔 Vice-Président',
    TRESORIER: '💳 Trésorier',
    SECRETAIRE_GENERAL: '📋 Secrétaire Général',
    MEMBER: '👤 Membre',
  };
  return labels[role] || role;
};

/**
 * ============= Composant Access Management =============
 */
const AccessManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur chargement users:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les utilisateurs',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Center py={20}>
        <Spinner size="lg" color="var(--rbe-red)" />
      </Center>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Alert status="info">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold">Gestion des accès</Text>
          <Text fontSize="sm">Consultez et gérez les utilisateurs du système</Text>
        </Box>
      </Alert>

      <Card variant="outline">
        <CardBody>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr bg="gray.50">
                <Th>Utilisateur</Th>
                <Th>Email</Th>
                <Th>Rôle</Th>
                <Th>Créé</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td fontWeight="medium">{displayNameFromUser(user)}</Td>
                  <Td fontSize="sm">{user.email}</Td>
                  <Td>
                    <Badge colorScheme={user.role === 'admin' ? 'red' : 'blue'}>
                      {user.role}
                    </Badge>
                  </Td>
                  <Td fontSize="sm">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '-'}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>
    </VStack>
  );
};

/**
 * ============= Composant News Management =============
 */
const NewsManagement = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    featured: false,
    published: false,
    showOnExternal: false,
  });
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    loadNews();
    // Afficher les infos de debug
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    setDebugInfo({
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      user: user ? JSON.parse(user) : null,
      apiUrl: apiClient.baseURL
    });
  }, []);

  const loadNews = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/retro-news');
      setNews(Array.isArray(data) ? data : data?.news || []);
    } catch (error) {
      console.error('Erreur chargement news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ title: '', content: '', featured: false, published: false, showOnExternal: false });
    onCreateOpen();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      content: item.content,
      featured: item.featured || false,
      published: item.published || false,
      showOnExternal: item.showOnExternal || false,
    });
    onCreateOpen();
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast({
        title: 'Erreur',
        description: 'Le titre et le contenu sont requis',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      if (editingId) {
        await apiClient.put(`/api/retro-news/${editingId}`, formData);
        toast({ title: 'Succès', description: 'Actualité mise à jour', status: 'success' });
      } else {
        await apiClient.post('/api/retro-news', formData);
        toast({ title: 'Succès', description: 'Actualité créée', status: 'success' });
      }
      loadNews();
      onCreateClose();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', status: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer?')) return;
    try {
      await apiClient.delete(`/api/retro-news/${id}`);
      toast({ title: 'Succès', description: 'Actualité supprimée', status: 'success' });
      loadNews();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de supprimer', status: 'error' });
    }
  };

  if (loading) {
    return (
      <Center py={20}>
        <Spinner size="lg" color="var(--rbe-red)" />
      </Center>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Flex justify="space-between" align="center">
        <Heading size="md">📰 Actualités RétroBus</Heading>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={handleCreate}>
          Nouvelle actualité
        </Button>
      </Flex>

      <Alert status="info">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold">À propos des actualités</Text>
          <Text fontSize="sm">
            Les actualités créées ici seront disponibles dans la modale RétroActus et peuvent être partagées
          </Text>
        </Box>
      </Alert>

      {debugInfo && (
        <Card bg="gray.50" variant="outline">
          <CardBody>
            <VStack align="start" spacing={2} fontSize="sm">
              <Text fontWeight="bold">🔍 Informations Debug:</Text>
              <Text>Token présent: {debugInfo.hasToken ? '✅ Oui' : '❌ Non'}</Text>
              {debugInfo.hasToken && <Text>Token length: {debugInfo.tokenLength} chars</Text>}
              {debugInfo.user && (
                <>
                  <Text>Utilisateur: {debugInfo.user.username || debugInfo.user.email}</Text>
                  <Text>Rôle: {debugInfo.user.roles ? debugInfo.user.roles.join(', ') : 'N/A'}</Text>
                </>
              )}
              <Text>API URL: {debugInfo.apiUrl || 'Relative (proxy)'}</Text>
            </VStack>
          </CardBody>
        </Card>
      )}

      {news.length === 0 ? (
        <Card>
          <CardBody>
            <Center py={10} flexDirection="column">
              <Text mb={4} color="gray.500">Aucune actualité pour le moment</Text>
              <Button leftIcon={<FiPlus />} colorScheme="blue" size="sm" onClick={handleCreate}>
                Créer la première
              </Button>
            </Center>
          </CardBody>
        </Card>
      ) : (
        <SimpleGrid spacing={4} columns={{ base: 1, md: 2, lg: 3 }}>
          {news.map((item) => (
            <Card key={item.id} variant="outline" _hover={{ boxShadow: 'md' }} transition="all 0.2s">
              <CardHeader pb={3}>
                <VStack align="start" spacing={2}>
                  <Heading size="sm" noOfLines={2}>{item.title}</Heading>
                  <HStack spacing={2} flexWrap="wrap">
                    {item.published && <Badge colorScheme="green">Publié</Badge>}
                    {item.featured && <Badge colorScheme="purple">Vedette</Badge>}
                    {item.showOnExternal && <Badge colorScheme="blue">Externe</Badge>}
                  </HStack>
                </VStack>
              </CardHeader>
              <CardBody>
                <Text fontSize="sm" noOfLines={3} color="gray.600">
                  {item.content}
                </Text>
              </CardBody>
              <Divider />
              <CardBody>
                <HStack spacing={2} justify="flex-end">
                  <IconButton
                    icon={<FiEdit />}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(item)}
                    aria-label="Éditer"
                  />
                  <IconButton
                    icon={<FiTrash2 />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Supprimer"
                  />
                </HStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Modal Création/Édition */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingId ? '✏️ Modifier une actualité' : '✨ Nouvelle actualité'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Titre</FormLabel>
                <Input
                  placeholder="Titre de l'actualité..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Contenu</FormLabel>
                <Textarea
                  placeholder="Contenu..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                />
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>Vedette (affichage prioritaire)</FormLabel>
                <Switch
                  isChecked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  ml={2}
                />
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>Publié</FormLabel>
                <Switch
                  isChecked={formData.published}
                  onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                  ml={2}
                />
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>Afficher sur le site externe</FormLabel>
                <Switch
                  isChecked={formData.showOnExternal}
                  onChange={(e) => setFormData({ ...formData, showOnExternal: e.target.checked })}
                  ml={2}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Annuler
            </Button>
            <Button colorScheme="blue" onClick={handleSave}>
              {editingId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

/**
 * ============= Composant Permissions Management =============
 */
const PermissionsManagement = () => {
  const { user, roles, isAdmin } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  
  // Vérifier que l'utilisateur est admin (PRESIDENT ou admin équivalent)
  const canManage = isAdmin || (user && user.roles && user.roles.some(r => ADMIN_ROLES.includes(r)));

  useEffect(() => {
    if (canManage) {
      loadUsers();
    }
  }, [canManage]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/admin/users');
      if (Array.isArray(response)) {
        setUsers(response);
      } else {
        console.error('Format inattendu pour les utilisateurs');
        setUsers([]);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les utilisateurs',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async (userId) => {
    try {
      const response = await apiClient.get(`/api/admin/users/${userId}/permissions`);
      if (Array.isArray(response)) {
        setUserPermissions(response);
      }
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les permissions',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    loadUserPermissions(user.id);
  };

  const handlePermissionToggle = async (resource, action, currentValue) => {
    if (!selectedUser || !canManage) return;

    try {
      const newValue = !currentValue;
      
      if (newValue) {
        // Ajouter permission
        await apiClient.post(`/api/admin/users/${selectedUser.id}/permissions`, {
          resource,
          actions: [action],
        });
      } else {
        // Supprimer permission
        await apiClient.delete(
          `/api/admin/users/${selectedUser.id}/permissions/${resource}/${action}`
        );
      }

      // Recharger
      await loadUserPermissions(selectedUser.id);
      toast({
        title: 'Succès',
        description: 'Permission mise à jour',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Erreur mise à jour permission:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la permission',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const hasPermission = (resource, action) => {
    if (!userPermissions[resource]) return false;
    return userPermissions[resource].includes && 
           userPermissions[resource].includes(action);
  };

  const filteredUsers = users.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canManage) {
    return (
      <VStack spacing={6} align="stretch">
        <Alert status="error" variant="subtle" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" height="auto" p={6}>
          <AlertIcon boxSize="40px" mr={0} mb={4} />
          <Heading size="md" mb={2}>Accès Refusé</Heading>
          <Text>Seuls les administrateurs peuvent gérer les permissions.</Text>
        </Alert>
      </VStack>
    );
  }

  if (loading) {
    return (
      <Center minH="80vh">
        <VStack>
          <Spinner size="xl" color="var(--rbe-red)" />
          <Text>Chargement...</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <VStack align="start" spacing={1}>
            <Heading size="md" display="flex" alignItems="center" gap={2}>
              <FiShield /> Gestion des Permissions
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Configurez les droits d'accès pour chaque utilisateur
            </Text>
          </VStack>
          <Button
            leftIcon={<FiRefreshCw />}
            onClick={loadUsers}
            isLoading={loading}
            colorScheme="blue"
            variant="outline"
          >
            Actualiser
          </Button>
        </HStack>
      </Box>

      {/* Main Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} w="full">
        {/* Users List */}
        <Card bg={cardBg}>
          <CardHeader pb={3}>
            <Heading size="sm" mb={4}>👥 Utilisateurs</Heading>
            <Input
              placeholder="Rechercher..."
              size="sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardHeader>
          <CardBody pt={0}>
            <VStack spacing={2} maxH="600px" overflowY="auto" align="stretch">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <Button
                    key={u.id}
                    justifyContent="start"
                    variant={selectedUser?.id === u.id ? 'solid' : 'ghost'}
                    colorScheme="blue"
                    onClick={() => handleSelectUser(u)}
                    isFullWidth
                    textAlign="left"
                    p={3}
                    height="auto"
                    whiteSpace="normal"
                  >
                    <VStack align="start" spacing={0} width="100%">
                      <Text fontWeight="bold" fontSize="sm">
                        {u.firstName} {u.lastName}
                      </Text>
                      <HStack spacing={2}>
                        <Text fontSize="xs" color="gray.500">
                          {u.email}
                        </Text>
                        {u.role && (
                          <Badge colorScheme={getRoleColor(u.role)} fontSize="xs">
                            {getRoleLabel(u.role)}
                          </Badge>
                        )}
                      </HStack>
                    </VStack>
                  </Button>
                ))
              ) : (
                <Text textAlign="center" color="gray.500" py={8}>
                  Aucun utilisateur trouvé
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Permissions Grid */}
        <Box gridColumn={{ lg: '2 / 4' }}>
          {selectedUser ? (
            <Card bg={cardBg}>
              <CardHeader>
                <VStack align="start" spacing={2}>
                  <Heading size="sm">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </Heading>
                  {selectedUser.role && (
                    <Badge colorScheme={getRoleColor(selectedUser.role)} fontSize="sm">
                      {getRoleLabel(selectedUser.role)}
                    </Badge>
                  )}
                </VStack>
              </CardHeader>
              <CardBody pt={0}>
                <VStack spacing={6} align="stretch">
                  {Object.entries(RESOURCE_CATEGORIES).map(([resource, category]) => (
                    <Box key={resource} p={4} borderWidth={1} borderRadius="md" borderColor="gray.200">
                      <Heading size="sm" mb={4}>
                        {category.label}
                      </Heading>
                      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                        {Object.entries(category.permissions).map(([action, label]) => (
                          <HStack key={`${resource}-${action}`} spacing={2}>
                            <Checkbox
                              isChecked={hasPermission(resource, action)}
                              onChange={() => handlePermissionToggle(resource, action, hasPermission(resource, action))}
                              colorScheme="blue"
                            />
                            <Text fontSize="sm">{label}</Text>
                          </HStack>
                        ))}
                      </SimpleGrid>
                    </Box>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          ) : (
            <Card bg={cardBg}>
              <CardBody>
                <Center p={10}>
                  <VStack>
                    <FiAlertCircle size={32} color="gray" />
                    <Text color="gray.500">
                      Sélectionnez un utilisateur pour gérer ses permissions
                    </Text>
                  </VStack>
                </Center>
              </CardBody>
            </Card>
          )}
        </Box>
      </SimpleGrid>

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <Card>
          <CardBody textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="blue.500">
              {users.length}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Utilisateurs
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="red.500">
              {users.filter(u => u.role === 'ADMIN').length}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Admins
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="purple.500">
              {users.filter(u => ADMIN_ROLES.includes(u.role)).length}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Administrateurs
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardBody textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="gray.500">
              {users.filter(u => u.role === 'MEMBER').length}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Membres
            </Text>
          </CardBody>
        </Card>
      </SimpleGrid>
    </VStack>
  );
};

/**
 * ============= Composant Settings =============
 */
const SiteSettings = () => {
  const [settings, setSettings] = useState({
    siteName: '',
    siteDescription: '',
    maintenanceMode: false,
  });

  return (
    <VStack spacing={6} align="stretch">
      <Alert status="info">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold">Paramètres du site</Text>
          <Text fontSize="sm">Configuration générale de RétroBus</Text>
        </Box>
      </Alert>

      <Card variant="outline">
        <CardHeader>
          <Heading size="md">Configuration générale</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>Nom du site</FormLabel>
              <Input placeholder="RétroBus Essonne" value={settings.siteName} />
            </FormControl>

            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea placeholder="Description du site..." value={settings.siteDescription} />
            </FormControl>

            <FormControl display="flex" alignItems="center">
              <FormLabel mb={0}>Mode maintenance</FormLabel>
              <Switch ml={2} isChecked={settings.maintenanceMode} />
            </FormControl>

            <Button colorScheme="blue" alignSelf="flex-start">
              Enregistrer les paramètres
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

/**
 * ============= Composant Documents Management =============
 */
const DocumentsManagement = () => {
  return (
    <VStack spacing={6} align="stretch">
      <Alert status="info">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold">Gestion des modèles de documents</Text>
          <Text fontSize="sm">Templates pour emails, lettres, et autres documents</Text>
        </Box>
      </Alert>

      <TemplateManagement />
    </VStack>
  );
};

/**
 * ============= Page Principale SiteManagement =============
 */
const SiteManagement = () => {
  const { user } = useUser();

  const sections = [
    {
      id: 'access',
      label: '🔐 Accès utilisateurs',
      icon: FiShield,
      render: () => <AccessManagement />,
    },
    {
      id: 'permissions',
      label: '🛡️ Permissions',
      icon: FiLock,
      render: () => <PermissionsManagement />,
    },
    {
      id: 'news',
      label: '📰 Actualités',
      icon: FiGlobe,
      render: () => <NewsManagement />,
    },
    {
      id: 'emails',
      label: '📧 Modèles d\'email',
      icon: FiMail,
      render: () => <EmailTemplateManager />,
    },
    {
      id: 'documents',
      label: '📄 Documents',
      icon: FiActivity,
      render: () => <DocumentsManagement />,
    },
    {
      id: 'settings',
      label: '⚙️ Paramètres',
      icon: FiSettings,
      render: () => <SiteSettings />,
    },
  ];

  return (
    <WorkspaceLayout
      title="Gestion du Site Web"
      subtitle="Accès, actualités, templates et configuration"
      sections={sections}
      defaultSectionId="access"
      sidebarTitle="Site Web"
      sidebarSubtitle="Administration"
      sidebarTitleIcon={FiGlobe}
      versionLabel="Site Management v2"
    />
  );
};

export default SiteManagement;
