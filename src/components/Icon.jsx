import React from 'react';
import * as LucideIcons from 'lucide-react';

const Icon = ({ name, size = 16, className = "" }) => {
  // Convert kebab-case to PascalCase for Lucide icons
  const pascalName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const LucideIcon = LucideIcons[pascalName] || LucideIcons.HelpCircle;

  return <LucideIcon size={size} className={className} />;
};

export default Icon;
