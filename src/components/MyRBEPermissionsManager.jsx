import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useToast,
  VStack,
  HStack,
  Text,
  Divider,
  Alert,
  AlertIcon,
  Checkbox,
  Spinner,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
  TabPanel,
  Tabs,
  TabList,
  Tab
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { fetchJson } from '../apiClient';
import { useFunctionManagement } from '../hooks/useFunctionPermissions';
import { groupFunctionsByModule, FUNCTION_DESCRIPTIONS } from '../utils/functionUtils';
import { FUNCTIONS, FUNCTION_GROUPS } from '../core/FunctionPermissions';

/**
 * MyRBEPermissionsManager - Gestion matricielle des permissions basée sur les fonctions
 * Vue d'ensemble: tous les utilisateurs vs toutes les fonctions granulaires par module
 */
export default function MyRBEPermissionsManager() {
  const toast = useToast();
  const { functions: allFunctions, groups, loading: functionsLoading, grantFunction, revokeFunction } = useFunctionManagement();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [userFunctions, setUserFunctions] = useState({}); // userId -> {functionId: true/false}

  const tableBg = useColorModeValue('white', 'gray.800');
  const headerBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  // Grouper les fonctions par module
  const functionsByModule = useMemo(() => {
    return groupFunctionsByModule(Object.keys(FUNCTIONS));
  }, []);

  const modules = useMemo(() => Object.keys(functionsByModule), [functionsByModule]);
  const currentModule = modules[selectedModuleIdx] || '';
  const currentFunctions = functionsByModule[currentModule] || [];

  // Charger les utilisateurs et leurs permissions
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Charger les utilisateurs
      const usersData = await fetchJson('/api/site-users');
      setUsers(Array.isArray(usersData) ? usersData : []);

      // Charger les permissions pour chaque utilisateur
      const permsMap = {};
      if (Array.isArray(usersData)) {
        for (const user of usersData) {
          try {
            const userPerms = await fetchJson(`/api/functions/user/${user.id}`);
            permsMap[user.id] = {};
            if (Array.isArray(userPerms)) {
              userPerms.forEach(fn => {
                permsMap[user.id][fn] = true;
              });
            }
          } catch (err) {
            console.warn(`Erreur chargement perms pour ${user.id}:`, err);
            permsMap[user.id] = {};
          }
        }
      }

      setUserFunctions(permsMap);
      console.log('✅ Données chargées:', usersData.length, 'utilisateurs');
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Activer/Désactiver l'accès à une fonction
  const toggleFunctionAccess = async (userId, functionId) => {
    try {
      setSaving(true);

      const hasAccess = userFunctions[userId]?.[functionId];

      if (hasAccess) {
        // Supprimer la permission
        await revokeFunction(userId, functionId);
        setUserFunctions(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            [functionId]: false
          }
        }));

        toast({
          title: 'Accès supprimé',
          status: 'success',
          duration: 2000
        });
      } else {
        // Ajouter la permission
        await grantFunction(userId, functionId);
        setUserFunctions(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            [functionId]: true
          }
        }));

        toast({
          title: 'Accès accordé',
          status: 'success',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setSaving(false);
    }
  };

  // Donner/Retirer accès à un groupe de fonctions
  const toggleGroupAccess = async (userId, groupId, grant) => {
    try {
      setSaving(true);

      const functionIds = FUNCTION_GROUPS[groupId] || [];

      for (const functionId of functionIds) {
        if (grant) {
          await grantFunction(userId, functionId);
          setUserFunctions(prev => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              [functionId]: true
            }
          }));
        } else {
          await revokeFunction(userId, functionId);
          setUserFunctions(prev => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              [functionId]: false
            }
          }));
        }
      }

      toast({
        title: grant ? 'Groupe accordé' : 'Groupe retiré',
        status: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast({
        title: 'Erreur',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user =>
    `${user.firstName} ${user.lastName} ${user.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  if (loading || functionsLoading) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4} align="center" py={8}>
            <Spinner size="lg" color="blue.500" />
            <Text>⏳ Chargement des permissions...</Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardBody>
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            Aucun utilisateur trouvé
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* En-tête */}
      <Box>
        <Heading size="lg" mb={2}>🎯 Gestion des accès par Fonction</Heading>
        <Text color="gray.600">
          Matrice permettant de gérer les accès granulaires aux fonctions du système pour chaque utilisateur.
          Les permissions individuelles priment sur les rôles.
        </Text>
      </Box>

      {/* Recherche utilisateurs */}
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.300" />
        </InputLeftElement>
        <Input
          placeholder="Rechercher un utilisateur..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </InputGroup>

      {/* Alerte info */}
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold" fontSize="sm">
            ℹ️ {filteredUsers.length} utilisateur(s) - {currentFunctions.length} fonction(s) dans "{currentModule}"
          </Text>
        </Box>
      </Alert>

      {/* Matrice par module */}
      <Card bg={tableBg}>
        <CardHeader>
          <Heading size="md">📊 Matrice des permissions par Module</Heading>
        </CardHeader>
        <Divider />
        <CardBody>
          <Tabs index={selectedModuleIdx} onChange={setSelectedModuleIdx} variant="enclosed" colorScheme="blue">
            <TabList mb={4}>
              {modules.map((module, idx) => (
                <Tab key={module}>
                  <HStack spacing={2}>
                    <Text>{module}</Text>
                    <Badge colorScheme="blue" fontSize="xs">{functionsByModule[module].length}</Badge>
                  </HStack>
                </Tab>
              ))}
            </TabList>

            <TabPanel>
              <Box overflowX="auto">
                <Table size="sm" variant="striped">
                  <Thead bg={headerBg}>
                    <Tr>
                      <Th position="sticky" left="0" bg={headerBg} zIndex="10" minW="200px">
                        Utilisateur
                      </Th>
                      <Th textAlign="center" minW="80px">
                        Accès
                      </Th>
                      {currentFunctions.map(functionId => {
                        const desc = FUNCTION_DESCRIPTIONS[functionId] || {};
                        return (
                          <Th key={functionId} textAlign="center" minW="85px" title={desc.description}>
                            <Box fontSize="xs" whiteSpace="normal" lineHeight="1.2">
                              {desc.name || functionId}
                            </Box>
                          </Th>
                        );
                      })}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredUsers.map(user => {
                      const userPerms = userFunctions[user.id] || {};
                      const accessCount = currentFunctions.filter(fn => userPerms[fn]).length;

                      return (
                        <Tr key={user.id} _hover={{ bg: hoverBg }}>
                          <Td
                            position="sticky"
                            left="0"
                            bg={tableBg}
                            zIndex="5"
                            fontWeight="medium"
                            minW="200px"
                          >
                            <VStack align="start" spacing={0}>
                              <Text>
                                {user.firstName} {user.lastName}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {user.email}
                              </Text>
                            </VStack>
                          </Td>
                          <Td textAlign="center">
                            <Badge
                              colorScheme={accessCount > 0 ? 'green' : 'gray'}
                              fontSize="xs"
                            >
                              {accessCount}/{currentFunctions.length}
                            </Badge>
                          </Td>
                          {currentFunctions.map(functionId => (
                            <Td key={functionId} textAlign="center">
                              <Checkbox
                                isChecked={!!userPerms[functionId]}
                                onChange={() => toggleFunctionAccess(user.id, functionId)}
                                isDisabled={saving}
                                size="md"
                                colorScheme="blue"
                              />
                            </Td>
                          ))}
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </Box>
            </TabPanel>
          </Tabs>
        </CardBody>
      </Card>

      {/* Gestion des groupes prédéfinis */}
      <Card>
        <CardHeader>
          <Heading size="md">👥 Groupes de Fonctions Prédéfinis</Heading>
        </CardHeader>
        <Divider />
        <CardBody>
          <VStack spacing={3} align="stretch">
            {Object.entries(FUNCTION_GROUPS).map(([groupId, functionIds]) => (
              <Card key={groupId} size="sm" bg="gray.50" p={3}>
                <HStack justify="space-between" align="start" spacing={4}>
                  <VStack align="start" spacing={1} flex={1}>
                    <Text fontWeight="bold" fontSize="sm">{groupId}</Text>
                    <Text fontSize="xs" color="gray.600">{functionIds.length} fonction(s)</Text>
                  </VStack>
                  <HStack spacing={1} flexWrap="wrap" justify="flex-end">
                    {filteredUsers.slice(0, 5).map(user => (
                      <Button
                        key={`grant-${user.id}-${groupId}`}
                        size="xs"
                        colorScheme="green"
                        onClick={() => toggleGroupAccess(user.id, groupId, true)}
                        isDisabled={saving}
                        title={`Accorder ${groupId} à ${user.firstName}`}
                      >
                        +{user.firstName?.substring(0, 1).toUpperCase()}
                      </Button>
                    ))}
                  </HStack>
                </HStack>
              </Card>
            ))}
          </VStack>
        </CardBody>
      </Card>

      {/* Info et instructions */}
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold" fontSize="sm">⚙️ À savoir</Text>
          <VStack align="start" spacing={1} fontSize="xs" color="gray.700" mt={2}>
            <Text>• Cochez pour accorder l'accès à une fonction</Text>
            <Text>• Décochez pour révoquer l'accès</Text>
            <Text>• Les permissions individuelles priment sur les rôles</Text>
            <Text>• Les changements sont appliqués immédiatement</Text>
            <Text>• Utilisez les groupes pour accorder rapidement des ensembles de fonctions</Text>
            <Text>• Filtrez par utilisateur pour une meilleure visibilité</Text>
          </VStack>
        </Box>
      </Alert>
    </VStack>
  );
}
