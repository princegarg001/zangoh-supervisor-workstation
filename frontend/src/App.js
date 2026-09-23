import React from 'react';
import { ChakraProvider, Box } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import theme from './theme';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ConversationView from './pages/ConversationView';
import AgentConfig from './pages/AgentConfig';
import Templates from './pages/Templates';
import Analytics from './pages/Analytics';
import { SupervisorProvider } from './context/SupervisorContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { AppDataProvider } from './context/AppDataContext';

function App() {
  return (
    <ChakraProvider theme={theme}>
      <SupervisorProvider>
        <WebSocketProvider>
          <AppDataProvider>
            <Router>
              <Box minHeight="100vh">
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/conversation/:id" element={<ConversationView />} />
                    <Route path="/agent-config" element={<AgentConfig />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="*" element={<Dashboard />} />
                  </Routes>
                </Layout>
              </Box>
            </Router>
          </AppDataProvider>
        </WebSocketProvider>
      </SupervisorProvider>
    </ChakraProvider>
  );
}

export default App;
