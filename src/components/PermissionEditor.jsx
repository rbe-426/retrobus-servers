import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Textarea,
  VStack,
  useToast,
  Alert,
  AlertIcon,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  Checkbox,
  Stack,
  Text,
  IconButton,
  Spinner,
  Input
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { fetchJson } from '../apiClient';

/**
 * PermissionEditor - Modal pour éditer les permissions individuelles d'un utilisateur
 * Intègre avec API /api/user-permissions
 */
export default function PermissionEditor({ isOpen, onClose, user, onPermissionUpdated }) {
  const toast = useToast();
  
  // États
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState([]);
  
  // États pour ajouter une permission
  const [newPermission, setNewPermission] = useState({
    resource: '',
    actions: [],
    reason: '',
    expiresAt: ''
  });

  const RESOURCES = [
    { value: 'VEHICLES', label: '🚗 Véhicules' },
    { value: 'EVENTS', label: '🎉 Événements' },
    { value: 'FINANCE', label: '💰 Finance' },
    { value: 'MEMBERS', label: '👥 Adhérents' },
    { value: 'STOCK', label: '📦 Stock' },
    { value: 'SITE_MANAGEMENT', label: '🌐 Gestion du Site' },
    { value: 'NEWSLETTER', label: '📧 Newsletter' },
    { value: 'PLANNING', label: '📅 Planning' }
  ];

  const ACTIONS = [
    { value: 'READ', label: 'Lecture' },
    { value: 'CREATE', label: 'Créer' },
    { value: 'EDIT', label: 'Modifier' },
    { value: 'DELETE', label: 'Supprimer' }
  ];

  // Charger les permissions de l'utilisateur
  useEffect(() => {
    if (isOpen && user) {
      loadPermissions();
    }
  }, [isOpen, user]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await fetchJson(`/api/user-permissions/${user.id}`);
      
      if (data.success) {
        // Parser les actions si elles sont en JSON string
        const parsed = (data.permissions || []).map(p => ({
          ...p,
          actions: Array.isArray(p.actions) ? p.actions : JSON.parse(p.actions || '[]')
        }));
        setPermissions(parsed);
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Impossible de charger les permissions',
          status: 'error',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermission = async () => {
    if (!newPermission.resource || newPermission.actions.length === 0) {
      toast({
        title: 'Erreur',
        description: 'Sélectionnez une ressource et au moins une action',
        status: 'error',
        duration: 2000
      });
      return;
    }

    try {
      setSaving(true);
      const data = await fetchJson(`/api/user-permissions/${user.id}`, {
        method: 'POST',
        body: {
          resource: newPermission.resource,
          actions: newPermission.actions,
          reason: newPermission.reason || '',
          expiresAt: newPermission.expiresAt || null
        }
      });

      if (data.success) {
        toast({
          title: 'Succès',
          description: 'Permission ajoutée',
          status: 'success',
          duration: 2000
        });
        
        // Réinitialiser le formulaire
        setNewPermission({
          resource: '',
          actions: [],
          reason: '',
          expiresAt: ''
        });
        
        // Recharger les permissions
        await loadPermissions();
        
        // Notifier le parent
        if (onPermissionUpdated) {
          onPermissionUpdated();
        }
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Impossible d\'ajouter la permission',
          status: 'error',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 3000
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePermission = async (permissionResource) => {
    try {
      setSaving(true);
      const data = await fetchJson(`/api/user-permissions/${user.id}/${permissionResource}`, {
        method: 'DELETE'
      });

      if (data.success) {
        toast({
          title: 'Succès',
          description: 'Permission supprimée',
          status: 'success',
          duration: 2000
        });
        
        // Recharger les permissions
        await loadPermissions();
        
        // Notifier le parent
        if (onPermissionUpdated) {
          onPermissionUpdated();
        }
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Impossible de supprimer la permission',
          status: 'error',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 3000
      });
    } finally {
      setSaving(false);
    }
  };

  const isPermissionExpired = (expiresAt) => {
    return expiresAt && new Date(expiresAt) < new Date();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent maxHeight="90vh" overflowY="auto">
        <ModalHeader>
          🔐 Permissions de {user?.firstName} {user?.lastName}
        </ModalHeader>
        <ModalCloseButton isDisabled={loading || saving} />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Rôle actuel */}
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold" fontSize="sm">
                  Rôle: <Badge ml={2} colorScheme="purple">{user?.role}</Badge>
                </Text>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  {user?.email}
                </Text>
              </Box>
            </Alert>

            {loading ? (
              <Box textAlign="center" py={6}>
                <Spinner />
              </Box>
            ) : (
              <>
                {/* Permissions existantes */}
                <Box>
                  <FormLabel fontWeight="bold" fontSize="md">
                    ✅ Permissions actuelles ({permissions.length})
                  </FormLabel>
                  {permissions.length === 0 ? (
                    <Alert status="warning" borderRadius="md" fontSize="sm">
                      <AlertIcon />
                      Aucune permission spécifique attribuée
                    </Alert>
                  ) : (
                    <Box overflowX="auto" borderRadius="md" border="1px" borderColor="gray.200">
                      <Table size="sm" variant="striped">
                        <Thead bg="gray.100">
                          <Tr>
                            <Th>Ressource</Th>
                            <Th>Actions</Th>
                            <Th>Raison</Th>
                            <Th>Expire</Th>
                            <Th width="50px">Action</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {permissions.map((perm) => {
                            const expired = isPermissionExpired(perm.expiresAt);
                            return (
                              <Tr key={perm.id} opacity={expired ? 0.6 : 1}>
                                <Td fontWeight="medium">
                                  {RESOURCES.find(r => r.value === perm.resource)?.label || perm.resource}
                                  {expired && (
                                    <Badge ml={2} colorScheme="red" fontSize="xs">EXPIRÉ</Badge>
                                  )}
                                </Td>
                                <Td>
                                  <HStack spacing={1}>
                                    {(perm.actions || []).map((action) => (
                                      <Badge key={action} colorScheme="blue" fontSize="xs">
                                        {ACTIONS.find(a => a.value === action)?.label || action}
                                      </Badge>
                                    ))}
                                  </HStack>
                                </Td>
                                <Td fontSize="sm" color="gray.600">
                                  {perm.reason || '-'}
                                </Td>
                                <Td fontSize="sm">
                                  {perm.expiresAt ? formatDate(perm.expiresAt) : '∞'}
                                </Td>
                                <Td>
                                  <IconButton
                                    icon={<DeleteIcon />}
                                    size="sm"
                                    colorScheme="red"
                                    variant="ghost"
                                    isLoading={saving}
                                    onClick={() => handleDeletePermission(perm.resource)}
                                  />
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </Box>

                <Divider />

                {/* Ajouter une permission */}
                <Box>
                  <FormLabel fontWeight="bold" fontSize="md">
                    ➕ Ajouter une permission
                  </FormLabel>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="medium">Ressource *</FormLabel>
                      <Select
                        placeholder="Sélectionner une ressource"
                        value={newPermission.resource}
                        onChange={(e) => setNewPermission({
                          ...newPermission,
                          resource: e.target.value
                        })}
                        isDisabled={saving}
                      >
                        {RESOURCES.map((res) => (
                          <option key={res.value} value={res.value}>
                            {res.label}
                          </option>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="medium">Actions *</FormLabel>
                      <Stack spacing={2} pl={2}>
                        {ACTIONS.map((action) => (
                          <Checkbox
                            key={action.value}
                            isChecked={newPermission.actions.includes(action.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewPermission({
                                  ...newPermission,
                                  actions: [...newPermission.actions, action.value]
                                });
                              } else {
                                setNewPermission({
                                  ...newPermission,
                                  actions: newPermission.actions.filter(a => a !== action.value)
                                });
                              }
                            }}
                            isDisabled={saving}
                          >
                            {action.label}
                          </Checkbox>
                        ))}
                      </Stack>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="medium">Raison (optionnelle)</FormLabel>
                      <Textarea
                        placeholder="Ex: Gestion d'un événement spécifique"
                        value={newPermission.reason}
                        onChange={(e) => setNewPermission({
                          ...newPermission,
                          reason: e.target.value
                        })}
                        isDisabled={saving}
                        size="sm"
                        rows={2}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="medium">Date d'expiration (optionnelle)</FormLabel>
                      <Input
                        type="date"
                        value={newPermission.expiresAt}
                        onChange={(e) => setNewPermission({
                          ...newPermission,
                          expiresAt: e.target.value
                        })}
                        isDisabled={saving}
                      />
                    </FormControl>
                  </VStack>
                </Box>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter borderTopWidth="1px">
          <HStack spacing={3}>
            <Button
              variant="ghost"
              onClick={onClose}
              isDisabled={loading || saving}
            >
              Fermer
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleAddPermission}
              isLoading={saving}
              isDisabled={!newPermission.resource || newPermission.actions.length === 0}
            >
              ➕ Ajouter Permission
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
