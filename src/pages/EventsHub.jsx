import React, { useState } from 'react';
import {
  VStack, HStack, Tabs, TabList, Tab, TabPanels, TabPanel,
  Heading, Box, useColorModeValue
} from '@chakra-ui/react';
import { FiCalendar, FiMapPin, FiClock } from 'react-icons/fi';
import WorkspaceLayout from '../components/Layout/WorkspaceLayout';
import EventsManagement from './EventsManagement';
import RetroGPS from '../components/RetroGPS';

/**
 * EventsHub - Page centralisée pour la gestion des événements
 * Organise les différentes vues sous forme d'onglets :
 * - Gestion des événements (création, liste, détails)
 * - Planification/Calendrier (à venir)
 * - RétroGPS (suivi GPS en direct) - feature future
 */
export default function EventsHub() {
  const [tabIndex, setTabIndex] = useState(0);
  const tabsBg = useColorModeValue('gray.50', 'gray.900');

  const renderEventsSection = () => (
    <Box>
        <Tabs 
          index={tabIndex} 
          onChange={setTabIndex}
          variant="enclosed"
          colorScheme="green"
        >
          <TabList borderBottom="2px solid" borderColor="green.200">
            <Tab _selected={{ color: 'white', bg: 'green.500' }}>
              <HStack spacing={2}>
                <FiCalendar />
                <span>Gestion des événements</span>
              </HStack>
            </Tab>
            
            <Tab _selected={{ color: 'white', bg: 'teal.500' }}>
              <HStack spacing={2}>
                <FiClock />
                <span>Planification</span>
              </HStack>
            </Tab>
            
            <Tab _selected={{ color: 'white', bg: 'purple.500' }}>
              <HStack spacing={2}>
                <FiMapPin />
                <span>RétroGPS</span>
              </HStack>
            </Tab>
          </TabList>

          <TabPanels>
            {/* Onglet 1: Gestion des événements */}
            <TabPanel p={0} pt={6}>
              <EventsManagement />
            </TabPanel>

            {/* Onglet 2: Planification / Calendrier */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Box p={6} bg="teal.50" borderRadius="lg" borderLeft="4px solid" borderColor="teal.500">
                  <Heading size="md" mb={2}>📅 Vue Calendrier</Heading>
                  <p>Bientôt disponible : calendrier interactif de vos tournées et événements.</p>
                </Box>
              </VStack>
            </TabPanel>

            {/* Onglet 3: RétroGPS (placeholder) */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <RetroGPS />
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
    </Box>
  );

  return (
    <WorkspaceLayout
      title="Gestion des événements"
      subtitle="Créez, planifiez et suivez les tournées RétroBus"
      sections={[{ id: 'events', label: 'Événements', icon: FiCalendar, render: renderEventsSection }]}
      defaultSectionId="events"
      sidebarTitle="Événements"
      sidebarSubtitle="Organisation & planning"
      sidebarTitleIcon={FiCalendar}
      versionLabel="Events v2"
    />
  );
}
