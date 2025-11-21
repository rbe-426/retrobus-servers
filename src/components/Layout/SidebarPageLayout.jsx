import React from 'react';
import {
  Box, VStack, HStack, useColorModeValue, Heading, Text, Icon,
  Button, useMediaQuery, Divider
} from '@chakra-ui/react';
import { FiMenu, FiX } from 'react-icons/fi';

/**
 * SidebarPageLayout - Composant de layout moderne avec sidebar navigation
 * Similaire à Finance, réutilisable pour tous les modules
 * 
 * Usage:
 * <SidebarPageLayout
 *   title="Module Name"
 *   subtitle="Description"
 *   icon={FiIcon}
 *   sections={[
 *     { id: "dashboard", label: "Dashboard", icon: FiIcon }
 *   ]}
 *   activeSection={activeSection}
 *   onSectionChange={setActiveSection}
 * >
 *   <YourContent />
 * </SidebarPageLayout>
 */
const SidebarPageLayout = ({
  title = 'Module',
  subtitle = 'Description',
  icon: HeaderIcon = null,
  sections = [],
  activeSection = null,
  onSectionChange = () => {},
  children = null,
  headerGradient = 'linear(to-r, blue.500, blue.600)'
}) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [isMobile] = useMediaQuery('(max-width: 768px)');

  const bgSidebar = useColorModeValue('gray.50', 'gray.900');
  const bgMain = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.800');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeBorder = useColorModeValue('blue.500', 'blue.400');
  const textColor = useColorModeValue('gray.800', 'white');
  const subtitleColor = useColorModeValue('gray.600', 'gray.400');

  const sidebarWidth = sidebarOpen && !isMobile ? '280px' : isMobile ? '100%' : '0';

  return (
    <HStack align="stretch" spacing={0} h="100vh" bg={bgMain}>
      {/* ===== SIDEBAR ===== */}
      <Box
        w={sidebarWidth}
        bg={bgSidebar}
        borderRight="1px"
        borderColor={borderColor}
        overflowY="auto"
        overflowX="hidden"
        transition="width 0.3s ease"
        display={isMobile && !sidebarOpen ? 'none' : 'block'}
        position={isMobile ? 'absolute' : 'relative'}
        h="100%"
        zIndex={isMobile ? 10 : 'auto'}
        boxShadow={isMobile && sidebarOpen ? 'lg' : 'none'}
      >
        <VStack align="stretch" spacing={0} h="100%">
          {/* Sidebar Header */}
          <Box p={6} borderBottom="1px" borderColor={borderColor} bg={bgSidebar}>
            <HStack justify="space-between" mb={4}>
              <HStack spacing={3}>
                {HeaderIcon && (
                  <Icon as={HeaderIcon} w={6} h={6} color="blue.500" />
                )}
                <Heading size="md" color={textColor}>
                  {title}
                </Heading>
              </HStack>
              {isMobile && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FiX />
                </Button>
              )}
            </HStack>
            {subtitle && (
              <Text fontSize="xs" color={subtitleColor}>
                {subtitle}
              </Text>
            )}
          </Box>

          {/* Navigation Items */}
          <VStack align="stretch" spacing={1} px={3} py={4} flex={1}>
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <Button
                  key={section.id}
                  leftIcon={section.icon ? <Icon as={section.icon} /> : null}
                  variant="ghost"
                  justifyContent="flex-start"
                  w="100%"
                  bg={isActive ? activeBg : 'transparent'}
                  borderLeft="3px"
                  borderColor={isActive ? activeBorder : 'transparent'}
                  borderRadius={0}
                  px={4}
                  py={6}
                  fontSize="sm"
                  fontWeight={isActive ? '600' : '500'}
                  color={isActive ? activeBorder : textColor}
                  _hover={{
                    bg: hoverBg,
                    borderLeftColor: activeBorder
                  }}
                  onClick={() => {
                    onSectionChange(section.id);
                    if (isMobile) setSidebarOpen(false);
                  }}
                >
                  <Text truncate>{section.label}</Text>
                </Button>
              );
            })}
          </VStack>

          {/* Sidebar Footer */}
          {sections.length > 0 && (
            <Box
              p={4}
              borderTop="1px"
              borderColor={borderColor}
              fontSize="xs"
              color={subtitleColor}
              textAlign="center"
              bg={bgSidebar}
            >
              <Text>Navigation {title}</Text>
            </Box>
          )}
        </VStack>
      </Box>

      {/* ===== MAIN CONTENT ===== */}
      <VStack align="stretch" spacing={0} flex={1} h="100%" overflowY="auto">
        {/* Top Bar */}
        <HStack
          px={6}
          py={4}
          borderBottom="1px"
          borderColor={borderColor}
          bg={bgMain}
          spacing={4}
        >
          {isMobile && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSidebarOpen(true)}
            >
              <FiMenu />
            </Button>
          )}
          <Box flex={1}>
            {/* This space can be used for additional controls */}
          </Box>
        </HStack>

        {/* Content Area */}
        <Box flex={1} w="100%" overflowY="auto" p={6}>
          {children}
        </Box>
      </VStack>
    </HStack>
  );
};

export default SidebarPageLayout;
