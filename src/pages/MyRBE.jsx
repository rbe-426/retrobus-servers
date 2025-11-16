import React from "react";
import {
  SimpleGrid,
  VStack,
  Text,
  Button,
  HStack,
  Box,
  useColorModeValue,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Heading,
  Badge,
  Spinner
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import {
  FiDollarSign, FiPlus, FiCalendar, FiUsers, FiPackage,
  FiMail, FiGlobe, FiInbox, FiLifeBuoy, FiTool, FiShield,
  FiTruck, FiShoppingCart, FiAlertCircle
} from "react-icons/fi";
import { useUser } from "../context/UserContext";
import { canAccess, RESOURCES } from "../lib/permissions";
import { useUserPermissions } from "../hooks/useUserPermissions";
import PageLayout from '../components/Layout/PageLayout';
import ModernCard from '../components/Layout/ModernCard';
import PermissionsManager from '../components/PermissionsManager';

const cards = [
  // Accès général
  {
    title: "RétroDemandes",
    description: "Créez vos demandes et consultez vos devis",
    to: "/dashboard/retro-requests",
    icon: FiPlus,
    color: "blue",
    category: "general"
  },
  {
    title: "Récapitulatif Demandes",
    description: "Vue d'ensemble de toutes les RétroDemandes",
    to: "/dashboard/president/retro-requests",
    icon: FiPlus,
    color: "cyan",
    category: "general",
    requiredRole: ['PRESIDENT', 'ADMIN']
  },
  {
    title: "Retromail",
    description: "Messagerie interne de l'équipe",
    to: "/retromail",
    icon: FiInbox,
    color: "teal",
    category: "general"
  },
  {
    title: "RétroSupport",
    description: "Tickets: incidents, bugs et améliorations",
    to: "/dashboard/support",
    icon: FiLifeBuoy,
    color: "cyan",
    category: "general"
  },

  // Véhicules
  {
    title: "RétroBus",
    description: "Mécanique, véhicules et maintenance",
    to: "/dashboard/retrobus",
    icon: FiTool,
    color: "teal",
    category: "vehicles",
    resource: "VEHICLES"
  },

  // Événements
  {
    title: "Gestion des Événements",
    description: "Création, planification et suivi",
    to: "/dashboard/events-management",
    icon: FiCalendar,
    color: "green",
    category: "events",
    resource: "EVENTS"
  },
  {
    title: "RétroPlanning",
    description: "Calendrier centralisé: campagnes, tournées, affectations",
    to: "/dashboard/retroplanning",
    icon: FiCalendar,
    color: "orange",
    category: "events",
    resource: "PLANNING"
  },

  // Finance
  {
    title: "Gestion Financière",
    description: "Recettes, dépenses et opérations programmées",
    to: "/admin/finance",
    icon: FiDollarSign,
    color: "rbe",
    category: "finance",
    resource: "FINANCE"
  },

  // Membres & Adhésions
  {
    title: "Gérer les adhésions",
    description: "Membres, cotisations et documents",
    to: "/dashboard/members-management",
    icon: FiUsers,
    color: "blue",
    category: "members",
    resource: "MEMBERS"
  },

  // Stock
  {
    title: "Gestion des Stocks",
    description: "Inventaire et matériel de l'association",
    to: "/dashboard/stock-management",
    icon: FiPackage,
    color: "yellow",
    category: "stock",
    resource: "STOCK"
  },

  // Newsletter
  {
    title: "Gestion Newsletter",
    description: "Abonnés et campagnes d'envoi",
    to: "/dashboard/newsletter",
    icon: FiMail,
    color: "purple",
    category: "newsletter",
    resource: "NEWSLETTER"
  },

  // Administration
  {
    title: "Gestion du Site",
    description: "Changelog, contenu et mise à jour",
    to: "/dashboard/site-management",
    icon: FiGlobe,
    color: "pink",
    category: "admin",
    resource: "SITE_MANAGEMENT"
  },
  {
    title: "Gestion des Autorisations",
    description: "Rôles et permissions des utilisateurs",
    to: "/dashboard/myrbe/permissions",
    icon: FiShield,
    color: "red",
    category: "admin",
    requiredRole: ['ADMIN', 'MANAGER', 'OPERATOR']
  }
];

// Catégories d'onglets
const TABS = [
  { id: 'general', label: '📌 Accueil', icon: FiPlus },
  { id: 'vehicles', label: '🚗 Véhicules', icon: FiTruck, resource: 'VEHICLES' },
  { id: 'events', label: '🎉 Événements', icon: FiCalendar, resource: 'EVENTS' },
  { id: 'finance', label: '💰 Finance', icon: FiDollarSign, resource: 'FINANCE' },
  { id: 'members', label: '👥 Membres', icon: FiUsers, resource: 'MEMBERS' },
  { id: 'stock', label: '📦 Stock', icon: FiPackage, resource: 'STOCK' },
  { id: 'newsletter', label: '📧 Newsletter', icon: FiMail, resource: 'NEWSLETTER' },
  { id: 'admin', label: '⚙️ Administration', icon: FiGlobe, resource: 'SITE_MANAGEMENT' }
];

export default function MyRBE() {
  const alertBg = useColorModeValue("blue.50", "blue.900");
  const alertBorder = useColorModeValue("blue.500", "blue.300");
  const { user, roles, customPermissions } = useUser();
  const userRole = roles?.[0] || 'MEMBER';
  const { permissions: userPermissions, loading: permissionsLoading } = useUserPermissions(user?.id);
  const [showPermissions, setShowPermissions] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);
  
  // Détecter si c'est demandé via URL
  const location = React.useMemo(() => window.location.pathname, []);
  React.useEffect(() => {
    if (location.includes('permissions')) {
      setShowPermissions(true);
    }
  }, [location]);

  /**
   * Vérifier si une carte doit être affichée
   */
  const shouldShowCard = (card) => {
    // Les ADMIN voient TOUT
    if (userRole === 'ADMIN') {
      return true;
    }

    // Les prestataires ne voient que RétroPlanning et RétroSupport
    if (userRole === 'PRESTATAIRE') {
      return card.title === 'RétroPlanning' || card.title === 'RétroSupport';
    }

    // Vérifier les rôles requis
    if (card.requiredRole && !card.requiredRole.includes(userRole)) {
      return false;
    }

    // Si la carte a une ressource, vérifier les permissions
    if (card.resource) {
      // Regarder d'abord les permissions individuelles
      const hasIndividualPermission = userPermissions.some(p => p.resource === card.resource);
      if (hasIndividualPermission) {
        return true;
      }

      // Sinon vérifier les permissions par rôle
      const cardPermissionMap = {
        'VEHICLES': RESOURCES.VEHICLES,
        'EVENTS': RESOURCES.EVENTS,
        'PLANNING': RESOURCES.RETROPLANNING,
        'FINANCE': RESOURCES.FINANCE,
        'MEMBERS': RESOURCES.MEMBERS,
        'STOCK': RESOURCES.STOCK,
        'NEWSLETTER': RESOURCES.NEWSLETTER,
        'SITE_MANAGEMENT': RESOURCES.SITE_MANAGEMENT
      };

      const requiredResource = cardPermissionMap[card.resource];
      return !requiredResource || canAccess(userRole, requiredResource, customPermissions);
    }

    // Les cartes sans ressource sont toujours visibles
    return true;
  };

  /**
   * Filtrer les cartes par catégorie et droits d'accès
   */
  const getCardsByCategory = (category) => {
    return cards
      .filter(card => card.category === category)
      .filter(shouldShowCard);
  };

  /**
   * Vérifier si un onglet doit être visible
   */
  const isTabVisible = (tab) => {
    // L'onglet "Accueil" est toujours visible
    if (tab.id === 'general') return true;

    // L'onglet "Administration" est réservé aux admins/managers/operators
    if (tab.id === 'admin') {
      return ['ADMIN', 'MANAGER', 'OPERATOR'].includes(userRole);
    }

    // Pour les autres onglets, vérifier les permissions individuelles OU les permissions par rôle
    if (tab.resource) {
      // Permission individuelle
      const hasIndividualPermission = userPermissions.some(p => p.resource === tab.resource);
      if (hasIndividualPermission) return true;

      // Permission par rôle
      const resourceMap = {
        'VEHICLES': RESOURCES.VEHICLES,
        'EVENTS': RESOURCES.EVENTS,
        'FINANCE': RESOURCES.FINANCE,
        'MEMBERS': RESOURCES.MEMBERS,
        'STOCK': RESOURCES.STOCK,
        'NEWSLETTER': RESOURCES.NEWSLETTER,
        'SITE_MANAGEMENT': RESOURCES.SITE_MANAGEMENT
      };

      return canAccess(userRole, resourceMap[tab.resource], customPermissions);
    }

    return true;
  };

  const visibleTabs = TABS.filter(isTabVisible);
  const cardsByCategory = {};
  visibleTabs.forEach(tab => {
    cardsByCategory[tab.id] = getCardsByCategory(tab.id);
  });

  return (
    <PageLayout
      title="Espace MyRBE"
      subtitle="Les outils d'administration RétroBus Essonne"
      headerVariant="card"
      bgGradient="linear(to-r, blue.500, purple.600)"
      titleSize="xl"
      titleWeight="700"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard/home" },
        { label: "MyRBE", href: "/dashboard/myrbe" }
      ]}
    >
      <VStack spacing={8} align="stretch">
        {/* Section Permissions - Affiche PermissionsManager quand requis */}
        {showPermissions && (roles?.includes('ADMIN') || roles?.includes('MANAGER') || roles?.includes('OPERATOR')) && (
          <Box>
            <Button 
              mb={4}
              variant="ghost" 
              onClick={() => setShowPermissions(false)}
              size="sm"
            >
              ← Retour à MyRBE
            </Button>
            <Box bg={useColorModeValue('white', 'gray.800')} borderRadius="md" p={6} borderWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
              <Heading size="md" mb={4}>🛡️ Gestion des Autorisations</Heading>
              <PermissionsManager />
            </Box>
          </Box>
        )}

        {/* Grille des fonctionnalités avec onglets - Masquée si permissions affichées */}
        {!showPermissions && (
          <Box>
            {permissionsLoading ? (
              <VStack spacing={4} py={8}>
                <Spinner size="lg" />
                <Text>Chargement des permissions...</Text>
              </VStack>
            ) : (
              <Tabs colorScheme="blue" variant="enclosed" index={activeTab} onChange={setActiveTab}>
                <TabList overflowX="auto">
                  {visibleTabs.map((tab, idx) => (
                    <Tab key={tab.id}>
                      <HStack spacing={2}>
                        <Text>{tab.label}</Text>
                        {cardsByCategory[tab.id]?.length > 0 && (
                          <Badge colorScheme="blue">{cardsByCategory[tab.id].length}</Badge>
                        )}
                      </HStack>
                    </Tab>
                  ))}
                </TabList>

                <TabPanels>
                  {visibleTabs.map((tab) => (
                    <TabPanel key={tab.id}>
                      {cardsByCategory[tab.id]?.length > 0 ? (
                        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                          {cardsByCategory[tab.id].map((card) => (
                            <ModernCard
                              key={card.title}
                              title={card.title}
                              description={card.description}
                              icon={card.icon}
                              color={card.color}
                              badge={card.badge}
                              as={card.title === 'Gestion des Autorisations' ? 'button' : RouterLink}
                              to={card.title !== 'Gestion des Autorisations' ? card.to : undefined}
                              onClick={card.title === 'Gestion des Autorisations' ? () => setShowPermissions(true) : undefined}
                            />
                          ))}
                        </SimpleGrid>
                      ) : (
                        <Box
                          bg={useColorModeValue('gray.50', 'gray.900')}
                          borderRadius="md"
                          p={8}
                          textAlign="center"
                          borderWidth="2px"
                          borderStyle="dashed"
                          borderColor={useColorModeValue('gray.300', 'gray.600')}
                        >
                          <HStack justify="center" mb={3}>
                            <FiAlertCircle size={24} />
                          </HStack>
                          <Text fontWeight="bold" mb={2}>
                            Accès refusé
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            Vous n'avez pas les permissions pour accéder à cette section.
                            {userRole !== 'ADMIN' && (
                              <Text mt={2} fontSize="xs">
                                Contactez un administrateur pour demander l'accès.
                              </Text>
                            )}
                          </Text>
                        </Box>
                      )}
                    </TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            )}
          </Box>
        )}
        
        {/* Section d'aide */}
        {!showPermissions && (
          <VStack spacing={6}>
            <Box 
              bg={alertBg}
              p={6}
              borderRadius="xl" 
              borderLeft="4px solid"
              borderLeftColor={alertBorder}
              w="full"
            >
              <VStack spacing={3} align="start">
                <HStack>
                  <Text fontSize="lg" fontWeight="600" color="blue.700">
                    💡 Guide d'utilisation
                  </Text>
                </HStack>
                <Text color="blue.600" lineHeight="relaxed" fontSize="sm">
                  Votre vue MyRBE est personnalisée selon vos permissions. 
                  Les onglets affichés correspondent à vos droits d'accès. 
                  Les modifications que vous effectuez sont automatiquement sauvegardées 
                  et synchronisées avec les autres membres de l'équipe.
                </Text>
                <HStack spacing={3} pt={2}>
                  <Button size="sm" variant="secondary" colorScheme="blue">
                    Guide complet
                  </Button>
                  <Button size="sm" variant="modern" as={RouterLink} to="/dashboard/support">
                    Support technique
                  </Button>
                </HStack>
              </VStack>
            </Box>
            
            {/* Stats rapides */}
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} w="full">
              <ModernCard 
                title="Uptime" 
                description="99.9%" 
                color="green"
                variant="modern"
              />
              <ModernCard 
                title="Membres actifs" 
                description="45" 
                color="blue"
                variant="modern"
              />
              <ModernCard 
                title="Dernière sync" 
                description="Il y a 2 min" 
                color="gray"
                variant="modern"
              />
              <ModernCard 
                title="Version" 
                description="v2.1.3" 
                color="purple"
                variant="modern"
              />
            </SimpleGrid>
          </VStack>
        )}
      </VStack>
    </PageLayout>
  );
}