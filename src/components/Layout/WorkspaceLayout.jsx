import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  HStack,
  VStack,
  Heading,
  Text,
  Icon,
  Flex,
  useColorModeValue,
  useMediaQuery,
  Divider
} from "@chakra-ui/react";
import { FiMenu, FiX } from "react-icons/fi";

/**
 * WorkspaceLayout - shared shell for MyRBE feature pages.
 * Provides a responsive sidebar identical to the Finance page styling
 * so all workspaces keep a consistent navigation experience.
 */
const WorkspaceLayout = ({
  title,
  subtitle,
  sections = [],
  defaultSectionId,
  headerActions,
  footer,
  sidebarFooter,
  sidebarTitleIcon,
  sidebarTitle = "Espace MyRBE",
  sidebarSubtitle = "Outils d'administration",
  versionLabel = "MyRBE Workspace"
}) => {
  const [activeSection, setActiveSection] = useState(defaultSectionId || sections[0]?.id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile] = useMediaQuery("(max-width: 768px)");

  const bgSidebar = useColorModeValue("gray.50", "gray.900");
  const bgMain = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const hoverBg = useColorModeValue("gray.100", "gray.700");
  const activeBg = useColorModeValue("blue.50", "blue.900");
  const activeBorder = useColorModeValue("blue.500", "blue.300");
  const headingColor = useColorModeValue("gray.800", "whiteAlpha.900");
  const subtitleColor = useColorModeValue("gray.500", "gray.400");

  const currentSection = useMemo(
    () => sections.find((section) => section.id === activeSection) || sections[0],
    [activeSection, sections]
  );

  const SectionRenderer = currentSection?.render;

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <HStack align="stretch" spacing={0} h="100vh" bg={bgMain}>
      {/* Sidebar */}
      <Box
        w={sidebarOpen && !isMobile ? "280px" : isMobile ? "100%" : "0"}
        bg={bgSidebar}
        borderRight="1px"
        borderColor={borderColor}
        overflowY="auto"
        transition="width 0.3s ease"
        display={isMobile && !sidebarOpen ? "none" : "block"}
        position={isMobile ? "absolute" : "relative"}
        h="100%"
        zIndex={isMobile ? 20 : "auto"}
        boxShadow={isMobile && sidebarOpen ? "lg" : "none"}
      >
        <VStack align="stretch" spacing={0} h="full">
          <Box p={6} borderBottom="1px" borderColor={borderColor}>
            <HStack justify="space-between" mb={3}>
              <HStack spacing={3}>
                {sidebarTitleIcon && (
                  <Icon as={sidebarTitleIcon} color="blue.500" boxSize={6} />
                )}
                <Box>
                  <Heading size="md" color={headingColor}>{sidebarTitle}</Heading>
                  <Text fontSize="sm" color={subtitleColor}>{sidebarSubtitle}</Text>
                </Box>
              </HStack>
              {isMobile && (
                <Button size="sm" variant="ghost" onClick={toggleSidebar}>
                  <FiX />
                </Button>
              )}
            </HStack>
            {versionLabel && (
              <Text fontSize="xs" color="gray.500">{versionLabel}</Text>
            )}
          </Box>

          <VStack align="stretch" spacing={1} px={3} py={4} flex={1}>
            {sections.map((section) => {
              const isActive = section.id === currentSection?.id;
              const SectionIcon = section.icon;
              return (
                <Button
                  key={section.id}
                  leftIcon={SectionIcon ? <Icon as={SectionIcon} /> : undefined}
                  variant="ghost"
                  justifyContent="flex-start"
                  w="full"
                  bg={isActive ? activeBg : "transparent"}
                  borderLeft="3px"
                  borderColor={isActive ? activeBorder : "transparent"}
                  borderRadius={0}
                  px={4}
                  py={6}
                  fontSize="sm"
                  fontWeight={isActive ? "600" : "500"}
                  color={isActive ? activeBorder : "inherit"}
                  _hover={{ bg: hoverBg, borderLeftColor: activeBorder }}
                  onClick={() => {
                    setActiveSection(section.id);
                    if (isMobile) setSidebarOpen(false);
                  }}
                >
                  <Flex direction="column" align="flex-start">
                    <Text>{section.label}</Text>
                    {section.description && (
                      <Text fontSize="xs" color="gray.500">{section.description}</Text>
                    )}
                  </Flex>
                </Button>
              );
            })}
          </VStack>

          <Box p={4} borderTop="1px" borderColor={borderColor} fontSize="xs" color="gray.500" textAlign="center">
            {sidebarFooter || "MyRBE"}
          </Box>
        </VStack>
      </Box>

      {/* Main content */}
      <Box flex={1} overflowY="auto" position="relative" h="100%">
        {isMobile && !sidebarOpen && (
          <Button
            position="fixed"
            top={4}
            left={4}
            size="sm"
            variant="solid"
            zIndex={30}
            onClick={toggleSidebar}
          >
            <FiMenu />
          </Button>
        )}

        <Box p={6} minH="full">
          <Flex align={{ base: "flex-start", md: "center" }} justify="space-between" wrap="wrap" mb={6} gap={4}>
            <Box>
              <Heading size="lg" color={headingColor}>{title}</Heading>
              {subtitle && <Text color={subtitleColor}>{subtitle}</Text>}
            </Box>
            {headerActions && (
              <HStack spacing={3} flexWrap="wrap" justify="flex-end">
                {Array.isArray(headerActions) ? headerActions : headerActions}
              </HStack>
            )}
          </Flex>

          <Divider mb={6} />

          <Box>
            {SectionRenderer ? SectionRenderer() : (
              <Text color="gray.500">Aucune section disponible.</Text>
            )}
          </Box>

          {footer && <Box mt={10}>{footer}</Box>}
        </Box>
      </Box>
    </HStack>
  );
};

export default WorkspaceLayout;
