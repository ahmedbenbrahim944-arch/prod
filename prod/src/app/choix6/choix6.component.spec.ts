import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Choix6Component } from './choix6.component';

describe('Choix6Component', () => {
  let component: Choix6Component;
  let fixture: ComponentFixture<Choix6Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Choix6Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Choix6Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
