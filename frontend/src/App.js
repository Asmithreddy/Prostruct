// frontend/src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Container, Typography, FormControl, FormGroup, FormControlLabel, Checkbox, TextField, Paper, Button, Grid, Card, CardContent, Chip } from '@mui/material';
import L from 'leaflet';
import axios from 'axios';
import './App.css';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Custom icons for different roles
const roleIcons = {
  contractor: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  home_owner: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  affiliate: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  referral_partner: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  community_partner: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  geo_tech: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
};

// Role display names
const roleDisplayNames = {
  contractor: 'Contractor',
  home_owner: 'Home Owner',
  affiliate: 'Affiliate',
  referral_partner: 'Referral Partner',
  community_partner: 'Community Partner',
  geo_tech: 'Geo Tech',
};

// Role colors for chips
const roleColors = {
  contractor: '#e53935',
  home_owner: '#1976d2',
  affiliate: '#43a047',
  referral_partner: '#ff9800',
  community_partner: '#fdd835',
  geo_tech: '#9c27b0',
};

function App() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState({
    contractor: true,
    home_owner: true,
    affiliate: true,
    referral_partner: true,
    community_partner: true,
    geo_tech: true,
  });
  const [locationFilter, setLocationFilter] = useState('');
  const [suggestedMatches, setSuggestedMatches] = useState([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState('');

  // const API_BASE_URL = 'http://localhost:5000/api';
  const API_BASE_URL = 'https://prostruct.onrender.com';

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/contacts-with-roles`);
      setContacts(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setError('Failed to fetch contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Use useCallback to memoize the updateSuggestedMatches function
  const updateSuggestedMatches = useCallback(() => {
    const filteredContacts = contacts.filter(contact => {
      // Filter by selected roles
      const hasSelectedRole = contact.roles.some(role => selectedRoles[role]);
      
      // Filter by location
      const matchesLocation = locationFilter === '' || 
        contact.address.city.toLowerCase().includes(locationFilter) ||
        contact.address.state.toLowerCase().includes(locationFilter) ||
        contact.address.zip.toLowerCase().includes(locationFilter);
      
      return hasSelectedRole && matchesLocation;
    });

    // Create suggestions
    const matches = filteredContacts.map(contact => {
      const roles = contact.roles
        .filter(role => selectedRoles[role])
        .map(role => roleDisplayNames[role])
        .join(' and ');
      
      return {
        contact,
        suggestion: `You can contact ${contact.name} in ${contact.address.city}, ${contact.address.state} as a ${roles}.`
      };
    });

    setSuggestedMatches(matches);
  }, [contacts, selectedRoles, locationFilter]);

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    updateSuggestedMatches();
  }, [contacts, selectedRoles, locationFilter, updateSuggestedMatches]);

  const handleInitialize = async () => {
    try {
      setIsInitializing(true);
      setInitializationStatus('Initializing HubSpot data...');
      
      const response = await axios.post(`${API_BASE_URL}/initialize`);
      
      setInitializationStatus(`Initialization complete! Created ${response.data.contactsCreated} contacts and assigned ${response.data.rolesAssigned} roles.`);
      
      // Refresh contacts
      await fetchContacts();
    } catch (error) {
      console.error('Initialization error:', error);
      setInitializationStatus('Initialization failed. Please check console for details.');
    } finally {
      setTimeout(() => {
        setIsInitializing(false);
        setInitializationStatus('');
      }, 5000);
    }
  };

  const handleRoleChange = (role) => {
    setSelectedRoles({
      ...selectedRoles,
      [role]: !selectedRoles[role],
    });
  };

  const handleLocationFilterChange = (e) => {
    setLocationFilter(e.target.value.toLowerCase());
  };

  const filteredContacts = contacts.filter(contact => {
    // Filter by selected roles
    const hasSelectedRole = contact.roles.some(role => selectedRoles[role]);
    
    // Filter by location
    const matchesLocation = 
      locationFilter === '' || 
      contact.address.city.toLowerCase().includes(locationFilter) ||
      contact.address.state.toLowerCase().includes(locationFilter) ||
      contact.address.zip.toLowerCase().includes(locationFilter);
    
    return hasSelectedRole && matchesLocation;
  });

  return (
    <Container maxWidth="lg" className="app-container">
      <Typography variant="h4" component="h1" gutterBottom align="center" style={{ marginTop: 20 }}>
        ProStruct Engineering - Contact Map
      </Typography>

      {initializationStatus && (
        <Paper 
          elevation={3} 
          style={{ 
            padding: 16, 
            marginBottom: 20, 
            backgroundColor: isInitializing ? '#fff9c4' : '#e8f5e9' 
          }}
        >
          <Typography>{initializationStatus}</Typography>
        </Paper>
      )}

      {loading && !isInitializing ? (
        <Typography>Loading contacts...</Typography>
      ) : error ? (
        <Box>
          <Typography color="error">{error}</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleInitialize}
            disabled={isInitializing}
            style={{ marginTop: 16 }}
          >
            Initialize HubSpot Data
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper elevation={3} style={{ padding: 16 }}>
              <Typography variant="h6" gutterBottom>Filters</Typography>
              
              <Typography variant="subtitle1">Project Roles</Typography>
              <FormControl component="fieldset" style={{ marginBottom: 16 }}>
                <FormGroup>
                  {Object.keys(roleDisplayNames).map(role => (
                    <FormControlLabel
                      key={role}
                      control={
                        <Checkbox 
                          checked={selectedRoles[role]} 
                          onChange={() => handleRoleChange(role)}
                          style={{ color: roleColors[role] }}
                        />
                      }
                      label={roleDisplayNames[role]}
                    />
                  ))}
                </FormGroup>
              </FormControl>
              
              <Typography variant="subtitle1">Location</Typography>
              <TextField
                label="Filter by city, state, or zip"
                fullWidth
                variant="outlined"
                size="small"
                value={locationFilter}
                onChange={handleLocationFilterChange}
                style={{ marginBottom: 16 }}
              />

              <Button 
                variant="contained" 
                color="primary" 
                onClick={fetchContacts}
                fullWidth
                style={{ marginBottom: 16 }}
              >
                Refresh Contacts
              </Button>

              <Button 
                variant="outlined" 
                color="secondary" 
                onClick={handleInitialize}
                disabled={isInitializing}
                fullWidth
              >
                Initialize HubSpot Data
              </Button>
            </Paper>

            <Paper elevation={3} style={{ padding: 16, marginTop: 16 }}>
              <Typography variant="h6" gutterBottom>Map Legend</Typography>
              <Grid container spacing={1}>
                {Object.keys(roleDisplayNames).map(role => (
                  <Grid item xs={12} key={role}>
                    <Box display="flex" alignItems="center">
                      <Box
                        width={20}
                        height={20}
                        borderRadius="50%"
                        bgcolor={roleColors[role]}
                        mr={1}
                      />
                      <Typography variant="body2">{roleDisplayNames[role]}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={9}>
            <Paper elevation={3} style={{ height: '500px', marginBottom: 16 }}>
              {contacts.length > 0 ? (
                <MapContainer
                  center={[39.8283, -98.5795]} // Center of the US
                  zoom={4}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {filteredContacts.map(contact => (
                    contact.roles.filter(role => selectedRoles[role]).map(role => (
                      <Marker
                        key={`${contact.id}-${role}`}
                        position={[contact.coordinates.lat, contact.coordinates.lng]}
                        icon={roleIcons[role]}
                      >
                        <Popup>
                          <div>
                            <h3>{contact.name}</h3>
                            <p>Email: {contact.email}</p>
                            <p>Phone: {contact.phone}</p>
                            <p>Address: {contact.address.street}, {contact.address.city}, {contact.address.state} {contact.address.zip}</p>
                            <p>Roles: {contact.roles.map(r => roleDisplayNames[r]).join(', ')}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))
                  ))}
                </MapContainer>
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <Typography>No contacts available. Please initialize HubSpot data.</Typography>
                </Box>
              )}
            </Paper>

            <Paper elevation={3} style={{ padding: 16 }}>
              <Typography variant="h6" gutterBottom>Suggested Matches</Typography>
              {suggestedMatches.length > 0 ? (
                <Grid container spacing={2}>
                  {suggestedMatches.map((match, index) => (
                    <Grid item xs={12} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body1">{match.suggestion}</Typography>
                          <Box mt={1}>
                            {match.contact.roles.filter(role => selectedRoles[role]).map(role => (
                              <Chip 
                                key={role}
                                label={roleDisplayNames[role]}
                                style={{ 
                                  backgroundColor: roleColors[role],
                                  color: ['home_owner', 'community_partner'].includes(role) ? '#000' : '#fff',
                                  marginRight: 4,
                                  marginBottom: 4
                                }}
                                size="small"
                              />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography>No matches found for the current filters.</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

export default App;