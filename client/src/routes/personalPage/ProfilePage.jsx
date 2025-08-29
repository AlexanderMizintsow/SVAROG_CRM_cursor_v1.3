import React from 'react'
import {
  Container,
  Typography,
  Breadcrumbs,
  Card,
  CardContent,
  CardMedia,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
} from '@mui/material'
import { Link } from 'react-router-dom'
import './profilePage.scss'

const ProfilePage = () => {
  return (
    <section className="profile-page">
      <Container className="py-5">
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Breadcrumbs>
              <Link to="/">Home</Link>
              <Link to="/user">User</Link>
              <Typography color="textPrimary">User Profile</Typography>
            </Breadcrumbs>
          </Grid>

          <Grid item lg={4}>
            <Card className="mb-4">
              <CardContent className="text-center">
                <CardMedia
                  component="img"
                  image="https://mdbcdn.b-cdn.net/img/Photos/new-templates/bootstrap-chat/ava3.webp"
                  alt="avatar"
                  className="rounded-circle"
                />
                <Typography variant="body2" color="textSecondary" paragraph>
                  Full Stack Developer
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Bay Area, San Francisco, CA
                </Typography>
                <div className="button-group">
                  <Button variant="contained" color="primary">
                    Follow
                  </Button>
                  <Button variant="outlined" color="primary" className="ml-1">
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-4">
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Website"
                      secondary="https://mdbootstrap.com"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="GitHub" secondary="mdbootstrap" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Twitter" secondary="@mdbootstrap" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Instagram" secondary="mdbootstrap" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Facebook" secondary="mdbootstrap" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item lg={8}>
            <Card className="mb-4">
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item sm={3}>
                    <Typography>Full Name</Typography>
                  </Grid>
                  <Grid item sm={9}>
                    <Typography color="textSecondary">
                      Johnatan Smith
                    </Typography>
                  </Grid>
                </Grid>
                <hr />
                <Grid container spacing={2}>
                  <Grid item sm={3}>
                    <Typography>Email</Typography>
                  </Grid>
                  <Grid item sm={9}>
                    <Typography color="textSecondary">
                      example@example.com
                    </Typography>
                  </Grid>
                </Grid>
                <hr />
                <Grid container spacing={2}>
                  <Grid item sm={3}>
                    <Typography>Phone</Typography>
                  </Grid>
                  <Grid item sm={9}>
                    <Typography color="textSecondary">
                      (097) 234-5678
                    </Typography>
                  </Grid>
                </Grid>
                <hr />
                <Grid container spacing={2}>
                  <Grid item sm={3}>
                    <Typography>Mobile</Typography>
                  </Grid>
                  <Grid item sm={9}>
                    <Typography color="textSecondary">
                      (098) 765-4321
                    </Typography>
                  </Grid>
                </Grid>
                <hr />
                <Grid container spacing={2}>
                  <Grid item sm={3}>
                    <Typography>Address</Typography>
                  </Grid>
                  <Grid item sm={9}>
                    <Typography color="textSecondary">
                      Bay Area, San Francisco, CA
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Grid container spacing={3}>
              {[1, 2].map((index) => (
                <Grid item md={6} key={index}>
                  <Card className="mb-4">
                    <CardContent>
                      <Typography className="mb-4">
                        <span className="text-primary">assignment</span> Project
                        Status
                      </Typography>
                      {[
                        'Web Design',
                        'Website Markup',
                        'One Page',
                        'Mobile Template',
                        'Backend API',
                      ].map((label, idx) => (
                        <div key={idx}>
                          <Typography className="mb-1">{label}</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={[80, 72, 89, 55, 66][idx]}
                          />
                          <br />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </section>
  )
}

export default ProfilePage
