// Exposes the "current supervisor" identity to components (header switcher, message
// attribution). Identity itself lives in utils/supervisorStore so non-React code
// (the axios client) can read it too.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupervisorId, setSupervisorId, subscribeSupervisor, supervisorName, KNOWN_SUPERVISORS } from '../utils/supervisorStore';

const SupervisorContext = createContext(null);
export const useSupervisor = () => useContext(SupervisorContext);

export const SupervisorProvider = ({ children }) => {
  const [supervisorId, setId] = useState(getSupervisorId());

  useEffect(() => subscribeSupervisor(setId), []);

  const value = {
    supervisorId,
    supervisorName: supervisorName(supervisorId),
    setSupervisorId,
    knownSupervisors: KNOWN_SUPERVISORS,
  };

  return <SupervisorContext.Provider value={value}>{children}</SupervisorContext.Provider>;
};
