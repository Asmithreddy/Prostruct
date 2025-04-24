const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory token storage
let tokens = {
  access_token: env.accessToken,
  refresh_token: env.refresh_token,
  expires_at: env.expires_at,
};


// Function to check if we're authenticated
const isAuthenticated = () => {
  return !!tokens.refresh_token;
};

// Function to refresh access token
const getAccessToken = async () => {
  const now = Date.now();
  if (tokens.access_token && tokens.expires_at && now < tokens.expires_at) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new Error('AUTH_REQUIRED');
  }

  try {
    const response = await axios.post('https://api.hubapi.com/oauth/v1/token', new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      refresh_token: tokens.refresh_token
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = response.data;
    tokens.access_token = data.access_token;
    tokens.refresh_token = data.refresh_token || tokens.refresh_token;
    tokens.expires_at = now + (data.expires_in * 1000);

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    
    // If refresh token is invalid, clear tokens so we can re-authorize
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      tokens = {
        access_token: null,
        refresh_token: null,
        expires_at: null
      };
      throw new Error('AUTH_REQUIRED');
    }
    throw error;
  }
};

// Helper function to make authenticated requests to HubSpot
const hubspotRequest = async (endpoint, method = 'GET', data = null) => {
  try {
    const accessToken = await getAccessToken();
    const url = `https://api.hubapi.com${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    const config = {
      method,
      url,
      headers,
      data
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.message === 'AUTH_REQUIRED') {
      throw { status: 401, message: 'Authentication required. Please authorize the application.' };
    }
    console.error('Error making HubSpot request:', error.response?.data || error.message);
    throw error;
  }
};

// Get the authorization URL
app.get('/api/auth-url', (req, res) => {
  const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${process.env.HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent('http://localhost:5000/oauth-callback')}&scope=crm.objects.contacts.read%20crm.objects.contacts.write`;
  res.json({ authUrl });
});

// Check authentication status
app.get('/api/auth-status', (req, res) => {
  res.json({ 
    authenticated: isAuthenticated(),
    expires_at: tokens.expires_at || null
  });
});

// OAuth callback route
app.get('/oauth-callback', async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post('https://api.hubapi.com/oauth/v1/token', new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      redirect_uri: 'http://localhost:5000/oauth-callback',
      code
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = response.data;
    tokens.access_token = data.access_token;
    tokens.refresh_token = data.refresh_token;
    tokens.expires_at = Date.now() + (data.expires_in * 1000);

    // Redirect to the frontend
    res.redirect('http://localhost:3000?auth=success');
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.redirect('http://localhost:3000?auth=error');
  }
});

// API route to get contacts with roles
app.get('/api/contacts-with-roles', async (req, res) => {
  try {
    if (!isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required', 
        authRequired: true 
      });
    }

    // Get all contacts
    const contactsResponse = await hubspotRequest('/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,address,city,state,zip,project_role');
    const contacts = contactsResponse.results || [];

    // Filter contacts with project roles
    const contactsWithRoles = contacts.filter(contact => 
      contact.properties.project_role && contact.properties.project_role.trim() !== ''
    );

    // Format contacts for frontend
    const formattedContacts = contactsWithRoles.map(contact => {
      const roles = contact.properties.project_role ? 
        contact.properties.project_role.split(';') : [];
      
      return {
        id: contact.id,
        name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
        email: contact.properties.email || '',
        phone: contact.properties.phone || '',
        address: {
          street: contact.properties.address || '',
          city: contact.properties.city || '',
          state: contact.properties.state || '',
          zip: contact.properties.zip || ''
        },
        roles,
        // For demo purposes, generate random coordinates around the US
        coordinates: {
          lat: 37 + (Math.random() * 8) - 4, // Random lat around US
          lng: -100 + (Math.random() * 30) - 15 // Random lng around US
        }
      };
    });

    res.status(200).json(formattedContacts);
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: error.message,
        authRequired: true 
      });
    }
    console.error('Error fetching contacts:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch contacts from HubSpot',
      details: error.response?.data || error.message
    });
  }
});

// Step 2: Populate Contacts
app.post('/api/populate-contacts', async (req, res) => {
  try {
    if (!isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required', 
        authRequired: true 
      });
    }

    const mockContacts = [
      {
        properties: {
          firstname: 'John',
          lastname: 'Doe',
          email: 'john.doe@example.com',
          phone: '(123) 456-7890',
          address: '123 Main St',
          city: 'San Diego',
          state: 'CA',
          zip: '92101'
        }
      },
      {
        properties: {
          firstname: 'Jane',
          lastname: 'Smith',
          email: 'jane.smith@example.com',
          phone: '(234) 567-8901',
          address: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001'
        }
      },
      {
        properties: {
          firstname: 'Robert',
          lastname: 'Johnson',
          email: 'robert.johnson@example.com',
          phone: '(345) 678-9012',
          address: '789 Pine St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102'
        }
      },
      {
        properties: {
          firstname: 'Emily',
          lastname: 'Williams',
          email: 'emily.williams@example.com',
          phone: '(456) 789-0123',
          address: '101 Cedar Rd',
          city: 'Seattle',
          state: 'WA',
          zip: '98101'
        }
      },
      {
        properties: {
          firstname: 'Michael',
          lastname: 'Brown',
          email: 'michael.brown@example.com',
          phone: '(567) 890-1234',
          address: '202 Elm St',
          city: 'Portland',
          state: 'OR',
          zip: '97201'
        }
      },
      {
        properties: {
          firstname: 'Sarah',
          lastname: 'Davis',
          email: 'sarah.davis@example.com',
          phone: '(678) 901-2345',
          address: '303 Birch Ave',
          city: 'Denver',
          state: 'CO',
          zip: '80201'
        }
      },
      {
        properties: {
          firstname: 'David',
          lastname: 'Miller',
          email: 'david.miller@example.com',
          phone: '(789) 012-3456',
          address: '404 Maple Dr',
          city: 'Phoenix',
          state: 'AZ',
          zip: '85001'
        }
      },
      {
        properties: {
          firstname: 'Lisa',
          lastname: 'Wilson',
          email: 'lisa.wilson@example.com',
          phone: '(890) 123-4567',
          address: '505 Spruce Ln',
          city: 'Dallas',
          state: 'TX',
          zip: '75201'
        }
      },
      {
        properties: {
          firstname: 'James',
          lastname: 'Taylor',
          email: 'james.taylor@example.com',
          phone: '(901) 234-5678',
          address: '606 Willow Rd',
          city: 'Austin',
          state: 'TX',
          zip: '73301'
        }
      },
      {
        properties: {
          firstname: 'Jennifer',
          lastname: 'Anderson',
          email: 'jennifer.anderson@example.com',
          phone: '(012) 345-6789',
          address: '707 Ash St',
          city: 'Boston',
          state: 'MA',
          zip: '02108'
        }
      }
    ];

    const results = [];
    
    for (const contact of mockContacts) {
      const result = await hubspotRequest('/crm/v3/objects/contacts', 'POST', contact);
      results.push(result);
    }

    res.status(200).json({ success: true, contacts: results });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: error.message,
        authRequired: true 
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Step 3: Check and create custom property
app.post('/api/create-project-role-property', async (req, res) => {
  try {
    if (!isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required', 
        authRequired: true 
      });
    }

    // Check if property exists
    let propertyExists = false;
    try {
      const property = await hubspotRequest('/crm/v3/properties/contacts/project_role');
      propertyExists = true;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    if (!propertyExists) {
      // Create the property
      const propertyData = {
        name: 'project_role',
        label: 'Project Role',
        type: 'enumeration',
        fieldType: 'checkbox',
        groupName: 'contactinformation',
        options: [
          { label: 'Contractor', value: 'contractor' },
          { label: 'Home Owner', value: 'home_owner' },
          { label: 'Affiliate', value: 'affiliate' },
          { label: 'Referral Partner', value: 'referral_partner' },
          { label: 'Community Partner', value: 'community_partner' },
          { label: 'Geo Tech', value: 'geo_tech' }
        ]
      };

      const result = await hubspotRequest('/crm/v3/properties/contacts', 'POST', propertyData);
      res.status(200).json({ success: true, created: true, property: result });
    } else {
      res.status(200).json({ success: true, created: false, message: 'Property already exists' });
    }
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: error.message,
        authRequired: true 
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Step 4: Assign roles to contacts
app.post('/api/assign-roles', async (req, res) => {
  try {
    if (!isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required', 
        authRequired: true 
      });
    }

    // Get all contacts
    const contactsResponse = await hubspotRequest('/crm/v3/objects/contacts?limit=20');
    const contacts = contactsResponse.results || [];

    // Role assignments
    const roleAssignments = [
      ['contractor', 'home_owner'],
      ['geo_tech'],
      ['affiliate', 'referral_partner'],
      ['community_partner'],
      ['geo_tech', 'contractor'],
      ['home_owner'],
      ['affiliate'],
      ['referral_partner', 'community_partner'],
      ['contractor'],
      ['geo_tech', 'community_partner']
    ];

    const results = [];

    // Assign roles to contacts
    for (let i = 0; i < contacts.length && i < roleAssignments.length; i++) {
      const contact = contacts[i];
      const roles = roleAssignments[i];
      
      const updateData = {
        properties: {
          project_role: roles.join(';')
        }
      };

      const result = await hubspotRequest(`/crm/v3/objects/contacts/${contact.id}`, 'PATCH', updateData);
      results.push(result);
    }

    res.status(200).json({ success: true, assignments: results });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: error.message,
        authRequired: true 
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize endpoint for setup tasks
app.post('/api/initialize', async (req, res) => {
  try {
    if (!isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required', 
        authRequired: true 
      });
    }

    // Step 1: Check and create custom property
    let propertyExists = false;
    try {
      const property = await hubspotRequest('/crm/v3/properties/contacts/project_role');
      propertyExists = true;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    if (!propertyExists) {
      // Create the property
      const propertyData = {
        name: 'project_role',
        label: 'Project Role',
        type: 'enumeration',
        fieldType: 'checkbox',
        groupName: 'contactinformation',
        options: [
          { label: 'Contractor', value: 'contractor' },
          { label: 'Home Owner', value: 'home_owner' },
          { label: 'Affiliate', value: 'affiliate' },
          { label: 'Referral Partner', value: 'referral_partner' },
          { label: 'Community Partner', value: 'community_partner' },
          { label: 'Geo Tech', value: 'geo_tech' }
        ]
      };

      await hubspotRequest('/crm/v3/properties/contacts', 'POST', propertyData);
    }

    // Step 2: Create contacts
    const mockContacts = [
      {
        properties: {
          firstname: 'John',
          lastname: 'Doe',
          email: 'john.doe@example.com',
          phone: '(123) 456-7890',
          address: '123 Main St',
          city: 'San Diego',
          state: 'CA',
          zip: '92101'
        }
      },
      // ... all other contacts
      {
        properties: {
          firstname: 'Jennifer',
          lastname: 'Anderson',
          email: 'jennifer.anderson@example.com',
          phone: '(012) 345-6789',
          address: '707 Ash St',
          city: 'Boston',
          state: 'MA',
          zip: '02108'
        }
      }
    ];

    const createdContacts = [];
    for (const contact of mockContacts) {
      try {
        const result = await hubspotRequest('/crm/v3/objects/contacts', 'POST', contact);
        createdContacts.push(result);
      } catch (error) {
        // If email already exists, continue with next contact
        console.error('Error creating contact:', error.response?.data || error.message);
      }
    }

    // Step 3: Get created contacts for role assignment
    const contactsResponse = await hubspotRequest('/crm/v3/objects/contacts?limit=20');
    const contacts = contactsResponse.results || [];

    // Role assignments
    const roleAssignments = [
      ['contractor', 'home_owner'],
      ['geo_tech'],
      ['affiliate', 'referral_partner'],
      ['community_partner'],
      ['geo_tech', 'contractor'],
      ['home_owner'],
      ['affiliate'],
      ['referral_partner', 'community_partner'],
      ['contractor'],
      ['geo_tech', 'community_partner']
    ];

    // Assign roles to contacts
    const roleResults = [];
    for (let i = 0; i < contacts.length && i < roleAssignments.length; i++) {
      const contact = contacts[i];
      const roles = roleAssignments[i];
      
      const updateData = {
        properties: {
          project_role: roles.join(';')
        }
      };

      try {
        const result = await hubspotRequest(`/crm/v3/objects/contacts/${contact.id}`, 'PATCH', updateData);
        roleResults.push(result);
      } catch (error) {
        console.error('Error assigning role:', error.response?.data || error.message);
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Initialization complete',
      contactsCreated: createdContacts.length,
      rolesAssigned: roleResults.length
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: error.message,
        authRequired: true 
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OAuth callback URL: http://localhost:${PORT}/oauth-callback`);
  console.log('Ensure this URL is registered in your HubSpot app settings');
  
  if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
    console.error('WARNING: HUBSPOT_CLIENT_ID and/or HUBSPOT_CLIENT_SECRET environment variables are not set.');
    console.error('Please create a .env file with these values to enable HubSpot integration.');
  }
});