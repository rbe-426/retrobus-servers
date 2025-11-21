import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, VStack, HStack, Button, Flex, useToast, Text, Spinner,
  useDisclosure, SimpleGrid, Card, CardBody, CardHeader,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, FormControl, FormLabel, Input, Select,
  Textarea, Switch, Badge, IconButton, Menu, MenuButton, MenuList,
  MenuItem, Alert, AlertIcon, Tabs, TabList, TabPanels, Tab, TabPanel,
  Table, Thead, Tbody, Tr, Th, Td, InputGroup, InputLeftElement,
  useColorModeValue, Progress, Tooltip, ButtonGroup, Divider,
  Stat, StatLabel, StatNumber, StatHelpText, CheckboxGroup, Checkbox,
  Container, Heading, Icon, Center
} from "@chakra-ui/react";
import { 
  FiUsers, FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiMail,
  FiUserPlus, FiUserCheck, FiUserX, FiClock, FiTrendingUp,
  FiFilter, FiDownload, FiKey, FiShield, FiActivity, FiRefreshCw,
  FiSettings, FiLock, FiUnlock, FiRotateCcw, FiLogIn, FiLogOut, FiBarChart
} from 'react-icons/fi';
import { membersAPI } from '../api/members.js';
import CreateMember from '../components/CreateMember';
import WorkspaceLayout from '../components/Layout/WorkspaceLayout';

// API base builder with relative fallback
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (p) => apiBase ? `${apiBase}${p}` : p;

// === CONFIGURATIONS ===
const MEMBERSHIP_STATUS = {
  PENDING: { label: 'En attente', color: 'yellow', icon: FiClock },
  ACTIVE: { label: 'Actif', color: 'green', icon: FiUserCheck },
  EXPIRED: { label: 'Expiré', color: 'red', icon: FiUserX },
  SUSPENDED: { label: 'Suspendu', color: 'orange', icon: FiLock },
  CANCELLED: { label: 'Annulé', color: 'gray', icon: FiUserX }
};

const MEMBER_ROLES = {
  MEMBER: { label: 'Adhérent', color: 'blue', permissions: ['VIEW_PROFILE'] },
  DRIVER: { label: 'Conducteur', color: 'green', permissions: ['VIEW_PROFILE', 'DRIVE_VEHICLES'] },
  MODERATOR: { label: 'Modérateur', color: 'purple', permissions: ['VIEW_PROFILE', 'MODERATE_CONTENT'] },
  ADMIN: { label: 'Administrateur', color: 'red', permissions: ['FULL_ACCESS'] }
};

// === COMPOSANTS MODERNES ===
function MemberCard({ member, onEdit, onLinkAccess, onTerminate, onDeleteMember }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const statusConfig = MEMBERSHIP_STATUS[member.membershipStatus] || MEMBERSHIP_STATUS.PENDING;
  const roleConfig = MEMBER_ROLES[member.role] || MEMBER_ROLES.MEMBER;

  return (
    <Card bg={cardBg} borderWidth={1} borderColor="gray.200">
      <CardHeader pb={2}>
        <Flex justify="space-between" align="start">
          <VStack align="start" spacing={1}>
            <HStack>
              <Text fontWeight="bold" fontSize="md">
                {member.firstName} {member.lastName}
              </Text>
              <Badge colorScheme={statusConfig.color} size="sm">
                {statusConfig.label}
              </Badge>
              <Badge colorScheme={roleConfig.color} variant="outline" size="sm">
                {roleConfig.label}
              </Badge>
            </HStack>
            
            <Text fontSize="sm" color="gray.600">{member.email}</Text>
            
            {member.matricule && (
              <HStack spacing={2}>
                <Badge colorScheme="blue" variant="subtle">
                  🔑 {member.matricule}
                </Badge>
                {member.loginEnabled ? (
                  <Badge colorScheme="green" size="sm">✅ Accès activé</Badge>
                ) : (
                  <Badge colorScheme="gray" size="sm">❌ Accès désactivé</Badge>
                )}
              </HStack>
            )}
          </VStack>

          <Menu>
            <MenuButton as={IconButton} icon={<FiSettings />} variant="ghost" size="sm" />
            <MenuList>
              <MenuItem icon={<FiEdit />} onClick={() => onEdit(member)}>
                Modifier
              </MenuItem>
              <MenuItem icon={<FiUserX />} onClick={() => onTerminate(member)} color="red.500">
                Terminer l'adhésion
              </MenuItem>
              <MenuItem icon={<FiKey />} onClick={() => onLinkAccess(member)}>
                Associer à un accès existant
              </MenuItem>
              {member.membershipStatus === 'CANCELLED' && (
                <MenuItem icon={<FiTrash2 />} onClick={() => onDeleteMember(member)} color="red.600">
                  Effacer l'adhérent
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        </Flex>
      </CardHeader>

      <CardBody pt={0}>
        <VStack align="start" spacing={2}>
          {member.phone && (
            <Text fontSize="sm">📞 {member.phone}</Text>
          )}
          
          {member.lastLoginAt && (
            <Text fontSize="xs" color="gray.500">
              Dernière connexion: {new Date(member.lastLoginAt).toLocaleDateString('fr-FR')}
            </Text>
          )}
          
          {member.mustChangePassword && (
            <Badge colorScheme="orange" size="sm">
              ⚠️ Doit changer le mot de passe
            </Badge>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}

// === MODAL LOGS DE CONNEXION ===
function ConnectionLogsModal({ isOpen, onClose, member }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && member) {
      loadConnectionLogs();
    }
  }, [isOpen, member]);

  const loadConnectionLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/members/${member.id}/connection-logs`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Erreur chargement logs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          📊 Logs de connexion - {member?.firstName} {member?.lastName}
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          {loading ? (
            <VStack spacing={4}>
              <Spinner size="lg" />
              <Text>Chargement des logs...</Text>
            </VStack>
          ) : logs.length === 0 ? (
            <Alert status="info">
              <AlertIcon />
              Aucune connexion enregistrée pour ce membre
            </Alert>
          ) : (
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>IP</Th>
                  <Th>Statut</Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log, index) => (
                  <Tr key={index}>
                    <Td>{new Date(log.timestamp).toLocaleString('fr-FR')}</Td>
                    <Td>
                      <Badge colorScheme={log.type === 'LOGIN' ? 'green' : 'red'}>
                        {log.type === 'LOGIN' ? 'Connexion' : 'Déconnexion'}
                      </Badge>
                    </Td>
                    <Td>{log.ipAddress}</Td>
                    <Td>
                      <Badge colorScheme={log.success ? 'green' : 'red'}>
                        {log.success ? 'Succès' : 'Échec'}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </ModalBody>
        
        <ModalFooter>
          <Button onClick={onClose}>Fermer</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// === COMPOSANT PRINCIPAL ===
export default function MembersManagement() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showOnlyWithLogin, setShowOnlyWithLogin] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState(null);
  const [stats, setStats] = useState({});
  
  const { 
    isOpen: isCreateOpen, 
    onOpen: onCreateOpen, 
    onClose: onCreateClose 
  } = useDisclosure();
  
  const { 
    isOpen: isLogsOpen, 
    onOpen: onLogsOpen, 
    onClose: onLogsClose 
  } = useDisclosure();

  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose
  } = useDisclosure();

  const {
    isOpen: isTerminateOpen,
    onOpen: onTerminateOpen,
    onClose: onTerminateClose
  } = useDisclosure();

  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  const renderLoadingState = () => (
    <Center py={20}>
      <VStack spacing={4}>
        <Spinner size="xl" color="purple.500" />
        <Text color="gray.500">Chargement des membres...</Text>
      </VStack>
    </Center>
  );

  const [editData, setEditData] = useState(null);
  const [terminateMember, setTerminateMember] = useState(null);
  const [terminateForm, setTerminateForm] = useState({ reason: '', notes: '', pv: null, resignation: null });
  const {
    isOpen: isLinkOpen,
    onOpen: onLinkOpen,
    onClose: onLinkClose
  } = useDisclosure();
  const [linkForm, setLinkForm] = useState({ username: '', email: '' });

  // === CHARGEMENT DES DONNÉES ===
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await membersAPI.getAll();
      setMembers(data.members || []);
      calculateStats(data.members || []);
    } catch (error) {
      console.error('Erreur chargement membres:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les membres",
        status: "error",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (membersList) => {
    const total = membersList.length;
    const withLogin = membersList.filter(m => m.loginEnabled).length;
    const active = membersList.filter(m => m.membershipStatus === 'ACTIVE').length;
    const lastMonth = membersList.filter(m => {
      if (!m.lastLoginAt) return false;
      const lastLogin = new Date(m.lastLoginAt);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return lastLogin > monthAgo;
    }).length;

    setStats({
      total,
      withLogin,
      active,
      recentlyActive: lastMonth
    });
  };

  // === FILTRAGE ===
  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.matricule?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || member.membershipStatus === statusFilter;
    const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
    const matchesLogin = !showOnlyWithLogin || member.loginEnabled;

    return matchesSearch && matchesStatus && matchesRole && matchesLogin;
  });

  // === ACTIONS ===
  const handleToggleLogin = async (member) => {
    try {
      const action = member.loginEnabled ? 'disable' : 'enable';
      
      const response = await fetch(apiUrl(`/api/members/${member.id}/toggle-login`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la modification');
      }

      const data = await response.json();
      
      // Mettre à jour l'état local
      setMembers(prev => prev.map(m => 
        m.id === member.id 
          ? { ...m, loginEnabled: !m.loginEnabled, temporaryPassword: data.temporaryPassword }
          : m
      ));

      if (data.temporaryPassword) {
        toast({
          title: "Accès activé",
          description: `Mot de passe temporaire: ${data.temporaryPassword}`,
          status: "success",
          duration: 10000,
          isClosable: true
        });
      } else {
        toast({
          title: action === 'enable' ? "Accès activé" : "Accès désactivé",
          description: `L'accès MyRBE a été ${action === 'enable' ? 'activé' : 'désactivé'}`,
          status: "success",
          duration: 3000
        });
      }
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.message,
        status: "error",
        duration: 5000
      });
    }
  };

  const handleResetPassword = async (member) => {
    if (!window.confirm('Réinitialiser le mot de passe de ce membre ?')) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/members/${member.id}/reset-password`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la réinitialisation');
      }

      const data = await response.json();
      
      toast({
        title: "Mot de passe réinitialisé",
        description: `Nouveau mot de passe temporaire: ${data.temporaryPassword}`,
        status: "success",
        duration: 10000,
        isClosable: true
      });
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.message,
        status: "error",
        duration: 5000
      });
    }
  };

  // Logs de connexion ont été retirés de la gestion des adhésions

  const handleEdit = (member) => {
    setSelectedMember(member);
    setEditData({ ...member });
    onEditOpen();
  };

  const saveEdit = async () => {
    try {
      if (!selectedMember) return;
      const allowed = ['firstName','lastName','email','phone','address','city','postalCode','membershipType','membershipStatus','paymentAmount','paymentMethod','newsletter','notes'];
      const payload = {};
      for (const k of allowed) if (k in editData) payload[k] = editData[k];
      const resp = await fetch(apiUrl(`/api/members/${selectedMember.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(()=> ({}));
      if (!resp.ok) throw new Error(data?.error || 'Échec de la mise à jour');
      const updated = data.member || data;
      setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, ...updated } : m));
      toast({ title: 'Membre mis à jour', status: 'success' });
      onEditClose();
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, status: 'error' });
    }
  };

  const handleTerminate = (member) => {
    setTerminateMember(member);
    setTerminateForm({ reason: '', notes: '', pv: null, resignation: null });
    onTerminateOpen();
  };

  const confirmTerminate = async () => {
    try {
      if (!terminateMember) return;
      if (!terminateForm.reason) { toast({ title: 'Motif requis', status: 'error' }); return; }
      if (terminateForm.reason === 'EXCLUSION' && !terminateForm.pv) { toast({ title: 'PV obligatoire', status: 'error' }); return; }
      if (terminateForm.reason === 'DEMISSION' && (!terminateForm.pv || !terminateForm.resignation)) { toast({ title: 'PV et lettre obligatoires', status: 'error' }); return; }
      const fd = new FormData();
      fd.append('reason', terminateForm.reason);
      if (terminateForm.notes) fd.append('notes', terminateForm.notes);
      if (terminateForm.pv) fd.append('pv', terminateForm.pv);
      if (terminateForm.resignation) fd.append('resignation', terminateForm.resignation);
      const resp = await fetch(apiUrl(`/api/members/${terminateMember.id}/terminate`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: fd
      });
      const data = await resp.json().catch(()=> ({}));
      if (!resp.ok) throw new Error(data?.error || 'Échec de la résiliation');
      toast({ title: "Adhésion terminée", status: 'success' });
      await loadMembers();
      onTerminateClose();
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, status: 'error' });
    }
  };

  const handleDeleteMember = async (member) => {
    try {
      if (member.membershipStatus !== 'CANCELLED') {
        toast({ title: "Résiliez d'abord l'adhésion", status: 'warning' });
        return;
      }
      if (!window.confirm(`Effacer définitivement ${member.firstName} ${member.lastName} ?`)) return;
      const resp = await fetch(apiUrl(`/api/members/${member.id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!resp.ok && resp.status !== 204) {
        const data = await resp.json().catch(()=> ({}));
        throw new Error(data?.error || 'Suppression impossible');
      }
      toast({ title: "Adhérent effacé", status: 'success' });
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, status: 'error' });
    }
  };
  const handleMemberCreated = (newMember) => {
    setMembers(prev => [newMember, ...prev]);
    calculateStats([newMember, ...members]);
    onCreateClose();
  };

  const handleLinkAccess = (member) => {
    setSelectedMember(member);
    setLinkForm({ username: '', email: '' });
    onLinkOpen();
  };

  const confirmLinkAccess = async () => {
    try {
      if (!selectedMember) return;
      if (!linkForm.username && !linkForm.email) {
        toast({ title: 'Renseignez matricule ou email', status: 'warning' });
        return;
      }
      const resp = await fetch(apiUrl(`/api/members/${selectedMember.id}/link-access`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ username: linkForm.username || undefined, email: linkForm.email || undefined })
      });
      const data = await resp.json().catch(()=> ({}));
      if (!resp.ok) throw new Error(data?.error || 'Échec de l’association');
      toast({ title: 'Accès associé', status: 'success' });
      await loadMembers();
      onLinkClose();
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, status: 'error' });
    }
  };

  const renderDashboard = () => {
    if (loading) {
      return renderLoadingState();
    }

    return (
      <VStack spacing={8} align="stretch">
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Total adhérents</StatLabel>
                <StatNumber color="blue.500">{members.length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Actifs</StatLabel>
                <StatNumber color="green.500">{members.filter(m => m.membershipStatus === 'ACTIVE').length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>En attente</StatLabel>
                <StatNumber color="yellow.500">{members.filter(m => m.membershipStatus === 'PENDING').length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Accès activés</StatLabel>
                <StatNumber color="purple.500">{members.filter(m => m.loginEnabled).length}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {renderMembersTab()}
      </VStack>
    );
  };

  const renderMembersTab = () => {
    if (loading) {
      return renderLoadingState();
    }

    return (
      <Box>
        <HStack mb={6} spacing={4}>
          <InputGroup flex={1}>
            <InputLeftElement><FiSearch /></InputLeftElement>
            <Input
              placeholder="Chercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} w="150px">
            <option value="ALL">Tous</option>
            <option value="ACTIVE">Actif</option>
            <option value="PENDING">En attente</option>
            <option value="EXPIRED">Expiré</option>
          </Select>
          <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onCreateOpen}>
            Nouvel adhérent
          </Button>
        </HStack>
        {renderExistingContent('members')}
      </Box>
    );
  };

  const renderRolesTab = () => (
    <Box>
      <Heading size="md" mb={4}>Gestion des Rôles</Heading>
      <Text mb={4} color="gray.600">Configuration des rôles et permissions</Text>
      {renderExistingContent('roles')}
    </Box>
  );

  const renderSettingsTab = () => (
    <Box>
      <Heading size="md" mb={4}>Paramètres</Heading>
      {renderExistingContent('settings')}
    </Box>
  );

  const renderExistingContent = (section) => {
    // Pour l'instant, on retourne juste un placeholder
    return (
      <Card bg={cardBg}>
        <CardBody>
          <Text color="gray.500">Contenu de {section} à implémenter</Text>
        </CardBody>
      </Card>
    );
  };

  if (loading) {
    return (
      <SidebarPageLayout
        title="Gestion des Adhésions"
        subtitle="Créer et gérer les adhérents"
        icon={FiUsers}
        sections={sections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        headerGradient="linear(to-r, purple.500, purple.600)"
      >
        <Box textAlign="center" py={20}>
          <Spinner size="xl" color="purple.500" />
          <Text mt={4}>Chargement des membres...</Text>
        </Box>
      </SidebarPageLayout>
    );
  }

  return (
    <SidebarPageLayout
      title="Gestion des Adhésions"
      subtitle="Créer et gérer les adhérents"
      icon={FiUsers}
      sections={sections}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      headerGradient="linear(to-r, purple.500, purple.600)"
    >
      <Box>
        {renderContent()}
      {/* Header */}
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <VStack align="start" spacing={1}>
            <Heading size="xl" display="flex" alignItems="center">
              <FiUsers style={{ marginRight: '12px' }} />
              Gestion des Adhésions
            </Heading>
            <Text color="gray.600">Créer et gérer les adhérents (les identifiants sont gérés séparément)</Text>
          </VStack>
          
          <Button
            leftIcon={<FiPlus />}
            colorScheme="blue"
            size="lg"
            onClick={onCreateOpen}
          >
            Nouvel adhérent
          </Button>
        </HStack>

        {/* Statistiques */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Total membres</StatLabel>
                <StatNumber color="blue.500">{stats.total}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Avec accès MyRBE</StatLabel>
                <StatNumber color="green.500">{stats.withLogin}</StatNumber>
                <StatHelpText>{stats.total > 0 ? Math.round((stats.withLogin / stats.total) * 100) : 0}%</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Adhésions actives</StatLabel>
                <StatNumber color="purple.500">{stats.active}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          
          <Card bg={cardBg}>
            <CardBody>
              <Stat>
                <StatLabel>Connexions récentes</StatLabel>
                <StatNumber color="orange.500">{stats.recentlyActive}</StatNumber>
                <StatHelpText>30 derniers jours</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Filtres */}
        <Card bg={cardBg}>
          <CardBody>
            <VStack spacing={4}>
              <HStack w="full" spacing={4}>
                <InputGroup flex={2}>
                  <InputLeftElement>
                    <FiSearch />
                  </InputLeftElement>
                  <Input
                    placeholder="Rechercher par nom, email ou matricule..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
                
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  maxW="200px"
                >
                  <option value="ALL">Tous statuts</option>
                  {Object.entries(MEMBERSHIP_STATUS).map(([key, status]) => (
                    <option key={key} value={key}>{status.label}</option>
                  ))}
                </Select>
                
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  maxW="200px"
                >
                  <option value="ALL">Tous rôles</option>
                  {Object.entries(MEMBER_ROLES).map(([key, role]) => (
                    <option key={key} value={key}>{role.label}</option>
                  ))}
                </Select>
              </HStack>
              
              <HStack>
                <Checkbox
                  isChecked={showOnlyWithLogin}
                  onChange={(e) => setShowOnlyWithLogin(e.target.checked)}
                >
                  Afficher seulement les membres avec accès MyRBE
                </Checkbox>
                
                <Button leftIcon={<FiRefreshCw />} size="sm" onClick={loadMembers}>
                  Actualiser
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Liste des membres */}
        <Text fontSize="sm" color="gray.600">
          {filteredMembers.length} membre(s) affiché(s)
        </Text>
        
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
          {filteredMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={handleEdit}
              onLinkAccess={handleLinkAccess}
              onTerminate={handleTerminate}
              onDeleteMember={handleDeleteMember}
            />
          ))}
        </SimpleGrid>

        {filteredMembers.length === 0 && (
          <Alert status="info">
            <AlertIcon />
            Aucun membre ne correspond aux critères de recherche
          </Alert>
        )}
      </VStack>

      {/* Modals */}
      <CreateMember
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        onMemberCreated={handleMemberCreated}
      />
      
      {/* Connexion logs déplacés vers Gestion des accès */}

      {/* Link existing access modal */}
      <Modal isOpen={isLinkOpen} onClose={onLinkClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Associer à un accès existant</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Alert status="info"><AlertIcon />La création d’accès se fait dans "Gestion des accès". Ici, vous pouvez lier un accès existant (fusion).</Alert>
              <FormControl>
                <FormLabel>Matricule (username)</FormLabel>
                <Input value={linkForm.username} onChange={(e)=>setLinkForm(p=>({...p, username: e.target.value}))} placeholder="ex: jd2025" />
              </FormControl>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={linkForm.email} onChange={(e)=>setLinkForm(p=>({...p, email: e.target.value}))} placeholder="utilisateur@domaine.fr" />
              </FormControl>
              <Text fontSize="sm" color="gray.600">Renseignez au moins l’un des deux champs.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onLinkClose}>Annuler</Button>
            <Button colorScheme="blue" onClick={confirmLinkAccess}>Associer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit member modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Modifier le membre</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editData && (
              <VStack align="stretch" spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Prénom</FormLabel>
                    <Input value={editData.firstName || ''} onChange={(e)=>setEditData(p=>({...p, firstName: e.target.value}))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Nom</FormLabel>
                    <Input value={editData.lastName || ''} onChange={(e)=>setEditData(p=>({...p, lastName: e.target.value}))} />
                  </FormControl>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input type="email" value={editData.email || ''} onChange={(e)=>setEditData(p=>({...p, email: e.target.value}))} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Téléphone</FormLabel>
                    <Input value={editData.phone || ''} onChange={(e)=>setEditData(p=>({...p, phone: e.target.value}))} />
                  </FormControl>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Statut</FormLabel>
                    <Select value={editData.membershipStatus || 'ACTIVE'} onChange={(e)=>setEditData(p=>({...p, membershipStatus: e.target.value}))}>
                      <option value="PENDING">En attente</option>
                      <option value="ACTIVE">Actif</option>
                      <option value="EXPIRED">Expiré</option>
                      <option value="SUSPENDED">Suspendu</option>
                      <option value="CANCELLED">Annulé</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Type d'adhésion</FormLabel>
                    <Select value={editData.membershipType || 'STANDARD'} onChange={(e)=>setEditData(p=>({...p, membershipType: e.target.value}))}>
                      <option value="STANDARD">Standard</option>
                      <option value="FAMILY">Famille</option>
                      <option value="STUDENT">Étudiant</option>
                      <option value="HONORARY">Honneur</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel>Notes</FormLabel>
                  <Textarea value={editData.notes || ''} onChange={(e)=>setEditData(p=>({...p, notes: e.target.value}))} />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>Annuler</Button>
            <Button colorScheme="blue" onClick={saveEdit}>Enregistrer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Terminate membership modal */}
      <Modal isOpen={isTerminateOpen} onClose={onTerminateClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Terminer l'adhésion</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Alert status="warning"><AlertIcon />Cette action met fin à l'adhésion. L'accès site associé sera désactivé.</Alert>
              <FormControl isRequired>
                <FormLabel>Motif</FormLabel>
                <Select value={terminateForm.reason} onChange={(e)=>setTerminateForm(p=>({...p, reason:e.target.value}))}>
                  <option value="">Choisir un motif...</option>
                  <option value="FIN">Fin d'adhésion</option>
                  <option value="NON_RECONDUITE">Non reconduite</option>
                  <option value="EXCLUSION">Exclusion votée (joindre le PV)</option>
                  <option value="DEMISSION">Démission (joindre PV et lettre de démission)</option>
                  <option value="INFORMATIQUE">INFORMATIQUE</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Notes (optionnel)</FormLabel>
                <Textarea value={terminateForm.notes} onChange={(e)=>setTerminateForm(p=>({...p, notes:e.target.value}))} />
              </FormControl>
              {(terminateForm.reason === 'EXCLUSION' || terminateForm.reason === 'DEMISSION') && (
                <FormControl isRequired>
                  <FormLabel>Procès-verbal (PDF/Image)</FormLabel>
                  <Input type="file" accept="application/pdf,image/*" onChange={(e)=>setTerminateForm(p=>({...p, pv: e.target.files?.[0]||null}))} />
                </FormControl>
              )}
              {terminateForm.reason === 'DEMISSION' && (
                <FormControl isRequired>
                  <FormLabel>Lettre de démission (PDF/Image)</FormLabel>
                  <Input type="file" accept="application/pdf,image/*" onChange={(e)=>setTerminateForm(p=>({...p, resignation: e.target.files?.[0]||null}))} />
                </FormControl>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onTerminateClose}>Annuler</Button>
            <Button colorScheme="red" onClick={confirmTerminate}>Confirmer</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      </Box>
    </SidebarPageLayout>
  );
}