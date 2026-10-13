"use client";
import { createContext, useContext } from "react";
export const ProfileContext = createContext(null);
export function useProfileContext() { return useContext(ProfileContext); }
