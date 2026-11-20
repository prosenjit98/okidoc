'use client';

import { createContext, useContext } from 'react';

export const ClinicContext = createContext<any>(null);
/** The clinic (with myRole + entitlements) for the current console route. */
export const useClinic = () => useContext(ClinicContext);
